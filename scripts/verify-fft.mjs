// SonicCube - FFT 피크 정합성 검증 (A2)
// 테스트 WAV(L=440Hz, R=1kHz)를 모노 믹스 후 STFT 1프레임의 피크 bin이 기대 주파수와 일치하는지 확인.
// 주의: 이 스크립트는 src/audio/stft.ts 알고리즘과 동일 로직을 미러링한다.
import { readFileSync } from 'node:fs';

const FFT_SIZE = 2048;

// --- WAV(16bit PCM) 읽기 → 모노 Float32 ---
const buf = readFileSync('assets/test-tones/sine_440_1k_stereo.wav');
const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
const ascii = (o, l) => { let s = ''; for (let i = 0; i < l; i++) s += String.fromCharCode(view.getUint8(o + i)); return s; };
let off = 12, sampleRate = 0, channels = 0, dataOff = 0, dataSize = 0;
while (off + 8 <= view.byteLength) {
  const id = ascii(off, 4), size = view.getUint32(off + 4, true);
  if (id === 'fmt ') { channels = view.getUint16(off + 10, true); sampleRate = view.getUint32(off + 12, true); }
  else if (id === 'data') { dataOff = off + 8; dataSize = size; }
  off += 8 + size + (size & 1);
}
const totalSamples = dataSize / 2 / channels;
const mono = new Float32Array(totalSamples);
for (let i = 0; i < totalSamples; i++) {
  let acc = 0;
  for (let c = 0; c < channels; c++) acc += view.getInt16(dataOff + (i * channels + c) * 2, true) / 32768;
  mono[i] = acc / channels;
}

// --- Hann window ---
const win = new Float32Array(FFT_SIZE);
for (let i = 0; i < FFT_SIZE; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1));

// --- naive DFT(검증용, 독립 구현) on first frame ---
const re = new Float32Array(FFT_SIZE);
for (let i = 0; i < FFT_SIZE; i++) re[i] = mono[i] * win[i];
const bins = FFT_SIZE / 2;
const mag = new Float32Array(bins);
for (let k = 0; k < bins; k++) {
  let sr = 0, si = 0;
  for (let n = 0; n < FFT_SIZE; n++) {
    const a = (-2 * Math.PI * k * n) / FFT_SIZE;
    sr += re[n] * Math.cos(a);
    si += re[n] * Math.sin(a);
  }
  mag[k] = Math.hypot(sr, si);
}

// --- 상위 2개 피크 bin ---
const idx = [...mag.keys()].sort((a, b) => mag[b] - mag[a]);
const peaks = [];
for (const k of idx) {
  if (peaks.some((p) => Math.abs(p - k) < 3)) continue;
  peaks.push(k);
  if (peaks.length === 2) break;
}
peaks.sort((a, b) => a - b);
const freqStep = sampleRate / FFT_SIZE;
const tol = 1; // bin
const expect = [440, 1000];
let pass = true;
console.log(`sampleRate=${sampleRate} freqStep=${freqStep.toFixed(2)}Hz`);
peaks.forEach((k, i) => {
  const f = k * freqStep;
  const err = Math.abs(f - expect[i]) / freqStep;
  const ok = err <= tol;
  pass = pass && ok;
  console.log(`peak${i + 1}: bin ${k} = ${f.toFixed(1)}Hz (기대 ${expect[i]}Hz, 오차 ${err.toFixed(2)} bin) ${ok ? '✅' : '❌'}`);
});
console.log(pass ? 'A2 PASS ✅' : 'A2 FAIL ❌');
process.exit(pass ? 0 : 1);
