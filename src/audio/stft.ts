// SonicCube v0.3.0 - STFT 스펙트로그램 엔진 (Phase 2)
// 윈도잉 → 프레임 분할 → FFT → 매그니튜드 → dBFS 매트릭스.
import { FFT } from './fft';

export type WindowType = 'hann' | 'hamming' | 'blackman';

export interface StftParams {
  fftSize: number; // 2의 거듭제곱
  hopSize: number;
  window: WindowType;
}

/** 기본 분석 파라미터 (사용자 승인: FFT 2048 / hop 512 / Hann) */
export const DEFAULT_STFT_PARAMS: StftParams = {
  fftSize: 2048,
  hopSize: 512,
  window: 'hann',
};

/** dBFS 하한 (이보다 작은 값은 클램프) */
export const DB_FLOOR = -120;

export interface Spectrogram {
  frames: number; // 시간축 프레임 수
  bins: number; // 주파수축 bin 수 (fftSize/2)
  data: Float32Array; // [frame * bins + bin] = dB, row-major
  sampleRate: number; // 분석에 사용된 샘플레이트
  fftSize: number;
  hopSize: number;
  window: WindowType;
  timeStep: number; // 프레임당 시간 (초) = hop / sampleRate
  freqStep: number; // bin당 주파수 (Hz) = sampleRate / fftSize
  minDb: number; // 데이터 실제 최소 dB
  maxDb: number; // 데이터 실제 최대 dB
}

/** 윈도우 계수 생성 */
export function makeWindow(type: WindowType, n: number): Float32Array {
  const w = new Float32Array(n);
  const N = n - 1;
  for (let i = 0; i < n; i++) {
    switch (type) {
      case 'hann':
        w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
        break;
      case 'hamming':
        w[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / N);
        break;
      case 'blackman':
        w[i] = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / N) + 0.08 * Math.cos((4 * Math.PI * i) / N);
        break;
    }
  }
  return w;
}

/** 다채널 AudioBuffer 채널 데이터를 모노로 평균 */
export function mixToMono(channels: Float32Array[], length: number): Float32Array {
  if (channels.length === 1) return channels[0];
  const mono = new Float32Array(length);
  const inv = 1 / channels.length;
  for (const ch of channels) {
    for (let i = 0; i < length; i++) mono[i] += ch[i] * inv;
  }
  return mono;
}

/**
 * 모노 신호로부터 스펙트로그램을 계산한다.
 * @param onProgress 0..1 진행률 콜백 (선택)
 */
export function computeSpectrogram(
  mono: Float32Array,
  sampleRate: number,
  params: StftParams = DEFAULT_STFT_PARAMS,
  onProgress?: (p: number) => void,
): Spectrogram {
  const { fftSize, hopSize, window } = params;
  const bins = fftSize >> 1;
  const win = makeWindow(window, fftSize);
  // 윈도우 합 (진폭 정규화용) — full-scale 사인파가 약 0 dBFS가 되도록 2/Σw 스케일
  let winSum = 0;
  for (let i = 0; i < fftSize; i++) winSum += win[i];
  const ampScale = 2 / winSum;

  const frames = mono.length >= fftSize ? 1 + Math.floor((mono.length - fftSize) / hopSize) : 0;
  const data = new Float32Array(frames * bins);

  const fft = new FFT(fftSize);
  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);

  let minDb = Infinity;
  let maxDb = -Infinity;
  const progressEvery = Math.max(1, Math.floor(frames / 100));

  for (let f = 0; f < frames; f++) {
    const start = f * hopSize;
    for (let i = 0; i < fftSize; i++) {
      re[i] = mono[start + i] * win[i];
      im[i] = 0;
    }
    fft.transform(re, im);

    const rowOff = f * bins;
    for (let k = 0; k < bins; k++) {
      const mag = Math.hypot(re[k], im[k]) * ampScale;
      let db = 20 * Math.log10(mag + 1e-12);
      if (db < DB_FLOOR) db = DB_FLOOR;
      data[rowOff + k] = db;
      if (db < minDb) minDb = db;
      if (db > maxDb) maxDb = db;
    }

    if (onProgress && f % progressEvery === 0) onProgress(f / frames);
  }
  onProgress?.(1);

  if (!isFinite(minDb)) minDb = DB_FLOOR;
  if (!isFinite(maxDb)) maxDb = 0;

  return {
    frames,
    bins,
    data,
    sampleRate,
    fftSize,
    hopSize,
    window,
    timeStep: hopSize / sampleRate,
    freqStep: sampleRate / fftSize,
    minDb,
    maxDb,
  };
}
