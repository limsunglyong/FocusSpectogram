# audio/

오디오 처리 계층 (Phase 1~2, 5).

- **Phase 1** `decoder.ts` — 파일 입력 → `AudioContext.decodeAudioData` → PCM/메타데이터 추출
- **Phase 2** `stft.ts` — 윈도잉 + 프레임 분할 + FFT → 시간×주파수×dB 매트릭스 (Web Worker)
- **Phase 5** `player.ts` — `AudioBufferSourceNode` 기반 재생/트랜스포트
