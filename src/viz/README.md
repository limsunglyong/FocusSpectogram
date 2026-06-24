# viz/

3D 시각화 계층 (Three.js, Phase 3 이후).

- `SpectrogramScene.ts` — 카메라/렌더러/OrbitControls, 플레이헤드, LUFS 기준 평면 표시
- `surface.ts` — PlaneGeometry vertex 변위 기반 스펙트로그램 서피스. LUFS Plane이 켜진 경우 기준 이상 vertex를 적색으로 강조
- `axes.ts` — TIME/FREQUENCY/LEVEL 축과 눈금/라벨. LUFS 기준 라벨 표시 지원
- `colormap.ts` — 히트맵 컬러맵(-120dB ~ +6dB) 데이터
