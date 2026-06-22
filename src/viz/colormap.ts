// SonicCube v0.4.0 - 히트맵 컬러맵 (Phase 3)
// 정규화된 값 t∈[0,1] → RGB(0..1). 프로토타입 히트맵 범례와 동일한 그라디언트.
// deep navy → emerald → gold → light

type Stop = [number, [number, number, number]];

const STOPS: Stop[] = [
  [0.0, [6, 44, 43]], // #062c2b
  [0.33, [16, 185, 129]], // #10b981 emerald
  [0.66, [251, 191, 36]], // #fbbf24 gold
  [1.0, [253, 230, 138]], // #fde68a light
];

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** t∈[0,1] → [r,g,b] (0..1) */
export function colormap(t: number): [number, number, number] {
  t = clamp01(t);
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i - 1];
      const [t1, c1] = STOPS[i];
      const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      return [
        (c0[0] + (c1[0] - c0[0]) * f) / 255,
        (c0[1] + (c1[1] - c0[1]) * f) / 255,
        (c0[2] + (c1[2] - c0[2]) * f) / 255,
      ];
    }
  }
  const last = STOPS[STOPS.length - 1][1];
  return [last[0] / 255, last[1] / 255, last[2] / 255];
}
