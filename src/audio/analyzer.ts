// SonicCube v0.3.0 - 스펙트로그램 분석 오케스트레이터 (Phase 2)
// AudioBuffer → 모노 믹스 → Web Worker로 STFT → Spectrogram.
import { mixToMono, type Spectrogram, type StftParams, DEFAULT_STFT_PARAMS } from './stft';
import type { StftWorkerResponse } from './stft.worker';

export interface AnalyzeHandle {
  promise: Promise<Spectrogram>;
  cancel: () => void;
}

/**
 * AudioBuffer를 분석해 스펙트로그램을 생성한다.
 * @param onProgress 0..1 진행률 콜백
 */
export function analyzeAudio(
  buffer: AudioBuffer,
  params: StftParams = DEFAULT_STFT_PARAMS,
  onProgress?: (p: number) => void,
): AnalyzeHandle {
  // 채널 데이터 추출 후 모노 믹스 (메인 스레드, 가벼움)
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));
  const mono = mixToMono(channels, buffer.length);

  // 전송용 사본 (원본 AudioBuffer 데이터를 detach하지 않도록 복사)
  const monoCopy = new Float32Array(mono);

  const worker = new Worker(new URL('./stft.worker.ts', import.meta.url), { type: 'module' });

  const promise = new Promise<Spectrogram>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<StftWorkerResponse>) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        onProgress?.(msg.value);
      } else if (msg.type === 'done') {
        resolve({ ...msg.result, data: new Float32Array(msg.data) });
        worker.terminate();
      } else {
        reject(new Error(msg.message));
        worker.terminate();
      }
    };
    worker.onerror = (e) => {
      reject(new Error(e.message || '분석 워커 오류'));
      worker.terminate();
    };
  });

  const monoBuf = monoCopy.buffer as ArrayBuffer;
  worker.postMessage({ mono: monoBuf, sampleRate: buffer.sampleRate, params }, [monoBuf]);

  return {
    promise,
    cancel: () => worker.terminate(),
  };
}
