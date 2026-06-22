// SonicCube - 테스트용 사인파 WAV 생성기
// 사용: node scripts/gen-test-tone.mjs
// 출력: assets/test-tones/sine_440_1k_stereo.wav (L=440Hz, R=1000Hz, 3s, 44.1kHz, 16-bit)
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const sampleRate = 44100;
const seconds = 3;
const n = sampleRate * seconds;
const freqL = 440;
const freqR = 1000;
const amp = 0.8;

const bytesPerSample = 2;
const channels = 2;
const blockAlign = channels * bytesPerSample;
const dataSize = n * blockAlign;
const buf = Buffer.alloc(44 + dataSize);

// RIFF 헤더
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + dataSize, 4);
buf.write('WAVE', 8);
buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); // fmt chunk size
buf.writeUInt16LE(1, 20); // PCM
buf.writeUInt16LE(channels, 22);
buf.writeUInt32LE(sampleRate, 24);
buf.writeUInt32LE(sampleRate * blockAlign, 28);
buf.writeUInt16LE(blockAlign, 32);
buf.writeUInt16LE(bytesPerSample * 8, 34);
buf.write('data', 36);
buf.writeUInt32LE(dataSize, 40);

for (let i = 0; i < n; i++) {
  const t = i / sampleRate;
  const l = Math.sin(2 * Math.PI * freqL * t) * amp;
  const r = Math.sin(2 * Math.PI * freqR * t) * amp;
  const off = 44 + i * blockAlign;
  buf.writeInt16LE(Math.round(l * 32767), off);
  buf.writeInt16LE(Math.round(r * 32767), off + 2);
}

const out = 'assets/test-tones/sine_440_1k_stereo.wav';
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, buf);
console.log(`생성 완료: ${out} (${(buf.length / 1024).toFixed(1)} KB)`);
