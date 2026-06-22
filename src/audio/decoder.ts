// SonicCube v0.2.0 - 오디오 파일 디코딩 (Phase 1)
// File → AudioContext.decodeAudioData → PCM(AudioBuffer) + 메타데이터/피크 산출.

/** 디코딩된 오디오의 메타데이터 */
export interface AudioMeta {
  fileName: string;
  /**
   * v0.2.1: 표시용 원본 샘플레이트 (Hz). 파일 헤더에서 파싱.
   * 헤더 파싱 실패 시 analysisSampleRate로 폴백되고 sampleRateIsOriginal=false.
   */
  sampleRate: number;
  /** v0.2.1: 분석/재생에 사용되는 샘플레이트 = AudioBuffer.sampleRate (AudioContext 레이트) */
  analysisSampleRate: number;
  /** v0.2.1: sampleRate가 원본 헤더에서 확인된 값이면 true, 폴백이면 false */
  sampleRateIsOriginal: boolean;
  /** 채널 수 */
  channels: number;
  /** 길이 (초) */
  duration: number;
  /** 총 샘플 수 (채널당) */
  length: number;
  /** 피크 레벨 (dBFS, 0 이하). 무음이면 -Infinity */
  peakDb: number;
  /** Web Audio는 항상 32-bit float로 디코딩한다 */
  bitDepthLabel: string;
}

export interface DecodedAudio {
  buffer: AudioBuffer;
  meta: AudioMeta;
}

/** 권장 입력 포맷 (우선순위: mp3/wav). 그 외는 브라우저 디코더 지원 범위. */
export const ACCEPTED_EXTENSIONS = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'] as const;
export const ACCEPT_ATTR = 'audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac';

/** 디코딩 실패 시 사용자에게 보여줄 메시지를 담는 에러 */
export class AudioDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioDecodeError';
  }
}

// 브라우저당 하나의 AudioContext를 재사용 (탭당 컨텍스트 수 제한 회피)
let sharedContext: AudioContext | null = null;
export function getAudioContext(): AudioContext {
  if (!sharedContext) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedContext = new Ctor();
  }
  return sharedContext;
}

// v0.6.1: 가능하면 원본 샘플레이트로 디코드해 리샘플링을 막는다.
// 공유 AudioContext.decodeAudioData는 하드웨어 기본 레이트로 리샘플링하므로
// PC마다 나이퀴스트(주파수축 상한)가 달라진다(예: 48kHz 원본이 96kHz로 업샘플 → 축 0~48kHz).
// 원본 레이트를 알면 그 레이트의 OfflineAudioContext로 디코드해 어느 PC에서나 0~원본나이퀴스트로 통일한다.
async function decodeToBuffer(arrayBuffer: ArrayBuffer, originalSampleRate: number | null): Promise<AudioBuffer> {
  const sharedRate = getAudioContext().sampleRate;
  if (
    originalSampleRate != null &&
    originalSampleRate !== sharedRate &&
    typeof OfflineAudioContext !== 'undefined'
  ) {
    try {
      const offline = new OfflineAudioContext(1, 1, originalSampleRate);
      // decodeAudioData는 전달한 ArrayBuffer를 detach하므로 사본으로 시도 → 실패 시 원본으로 폴백 가능
      return await offline.decodeAudioData(arrayBuffer.slice(0));
    } catch {
      // 폴백: 공유 AudioContext로 디코드 (아래)
    }
  }
  // decodeAudioData는 일부 브라우저에서 Promise 미반환 → Promise 래핑으로 통일
  return await getAudioContext().decodeAudioData(arrayBuffer);
}

function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

// ---------------------------------------------------------------------------
// v0.2.1: 원본 샘플레이트 헤더 파싱
// decodeAudioData는 AudioContext 레이트로 리샘플링하므로 buffer.sampleRate는
// 원본이 아니다. 표시용 원본 값은 파일 헤더에서 직접 읽는다. (mp3/wav 우선)
// ---------------------------------------------------------------------------

function readAscii(view: DataView, offset: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

/** WAV(RIFF) 'fmt ' 청크에서 원본 샘플레이트(Hz)를 읽는다. 실패 시 null */
function parseWavSampleRate(view: DataView): number | null {
  if (view.byteLength < 44) return null;
  if (readAscii(view, 0, 4) !== 'RIFF' || readAscii(view, 8, 4) !== 'WAVE') return null;
  let off = 12;
  while (off + 8 <= view.byteLength) {
    const id = readAscii(view, off, 4);
    const size = view.getUint32(off + 4, true);
    if (id === 'fmt ') {
      // fmt 본문: audioFormat(2) numChannels(2) sampleRate(4)
      return view.getUint32(off + 12, true);
    }
    off += 8 + size + (size & 1); // 청크는 짝수 바이트 정렬
  }
  return null;
}

const MP3_SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000], // MPEG1
  2: [22050, 24000, 16000], // MPEG2
  0: [11025, 12000, 8000], // MPEG2.5
};

/** MP3 첫 프레임 헤더에서 원본 샘플레이트(Hz)를 읽는다. 실패 시 null */
function parseMp3SampleRate(view: DataView): number | null {
  let start = 0;
  // ID3v2 태그가 있으면 건너뛴다: 'ID3' + ver(2) + flags(1) + syncsafe size(4)
  if (view.byteLength > 10 && readAscii(view, 0, 3) === 'ID3') {
    const size =
      (view.getUint8(6) << 21) | (view.getUint8(7) << 14) | (view.getUint8(8) << 7) | view.getUint8(9);
    start = 10 + size;
  }
  // 프레임 sync(0xFFE) 탐색
  for (let i = start; i < view.byteLength - 4; i++) {
    if (view.getUint8(i) !== 0xff) continue;
    const b1 = view.getUint8(i + 1);
    if ((b1 & 0xe0) !== 0xe0) continue; // 상위 3비트 sync
    const version = (b1 >> 3) & 0x03; // 11=MPEG1, 10=MPEG2, 00=MPEG2.5
    const b2 = view.getUint8(i + 2);
    const srIndex = (b2 >> 2) & 0x03;
    const table = MP3_SAMPLE_RATES[version];
    if (table && srIndex < 3) return table[srIndex];
  }
  return null;
}

/** 확장자/헤더 기반으로 원본 샘플레이트를 추정. 실패 시 null */
function parseOriginalSampleRate(buf: ArrayBuffer, ext: string): number | null {
  const view = new DataView(buf);
  try {
    if (ext === '.wav') return parseWavSampleRate(view);
    if (ext === '.mp3') return parseMp3SampleRate(view);
    // 확장자가 모호하면 wav→mp3 순으로 시도
    return parseWavSampleRate(view) ?? parseMp3SampleRate(view);
  } catch {
    return null;
  }
}

/** 채널 전체를 훑어 최대 절대 진폭을 구한 뒤 dBFS로 변환 */
function computePeakDb(buffer: AudioBuffer): number {
  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i]);
      if (v > peak) peak = v;
    }
  }
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
}

/**
 * 오디오 파일을 디코딩한다.
 * @throws {AudioDecodeError} 미지원/손상 파일인 경우
 */
export async function decodeAudioFile(file: File): Promise<DecodedAudio> {
  const ext = extOf(file.name);
  if (ext && !ACCEPTED_EXTENSIONS.includes(ext as (typeof ACCEPTED_EXTENSIONS)[number])) {
    throw new AudioDecodeError(`지원하지 않는 형식입니다: ${ext} (권장: mp3, wav)`);
  }

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch {
    throw new AudioDecodeError('파일을 읽을 수 없습니다.');
  }
  if (arrayBuffer.byteLength === 0) {
    throw new AudioDecodeError('빈 파일입니다.');
  }

  // v0.2.1: 원본 샘플레이트는 decodeAudioData가 ArrayBuffer를 detach하기 전에 파싱한다.
  const originalSampleRate = parseOriginalSampleRate(arrayBuffer, ext);

  let buffer: AudioBuffer;
  try {
    buffer = await decodeToBuffer(arrayBuffer, originalSampleRate);
  } catch {
    throw new AudioDecodeError('오디오를 디코딩할 수 없습니다. 손상되었거나 브라우저가 지원하지 않는 형식일 수 있습니다.');
  }

  const meta: AudioMeta = {
    fileName: file.name,
    // 원본 헤더값이 있으면 표시용으로 사용, 없으면 분석 레이트로 폴백
    sampleRate: originalSampleRate ?? buffer.sampleRate,
    analysisSampleRate: buffer.sampleRate,
    sampleRateIsOriginal: originalSampleRate != null,
    channels: buffer.numberOfChannels,
    duration: buffer.duration,
    length: buffer.length,
    peakDb: computePeakDb(buffer),
    bitDepthLabel: '32-BIT FLOAT',
  };

  return { buffer, meta };
}
