# audio/

오디오 처리 계층 (Phase 1~2, 5).

- **Phase 1** `decoder.ts` — 파일 입력 → `AudioContext.decodeAudioData` → PCM/메타데이터 추출
- **Phase 2** `stft.ts` — 윈도잉 + 프레임 분할 + FFT → 시간×주파수×dB 매트릭스 (Web Worker)
  - 기본값은 FFT 2048 / Hop 512 / Hann이며, UI에서 Hop Size를 선택하면 현재 오디오 버퍼를 새 파라미터로 재분석한다.
- **Phase 5** `player.ts` — `AudioBufferSourceNode` 기반 재생/트랜스포트
