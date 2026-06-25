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

const LUFS_STOPS: Stop[] = [
  [0.0, [37, 99, 235]], // blue
  [0.34, [22, 163, 74]], // green
  [0.62, [163, 230, 53]], // light green
  [0.82, [250, 204, 21]], // yellow
  [1.0, [248, 113, 22]], // red-orange near LUFS
];

function interpolateStops(stops: Stop[], t: number): [number, number, number] {
  t = clamp01(t);
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      return [
        (c0[0] + (c1[0] - c0[0]) * f) / 255,
        (c0[1] + (c1[1] - c0[1]) * f) / 255,
        (c0[2] + (c1[2] - c0[2]) * f) / 255,
      ];
    }
  }
  const last = stops[stops.length - 1][1];
  return [last[0] / 255, last[1] / 255, last[2] / 255];
}

/** dBFS 값을 LUFS 기준에 적응시켜 blue→green→lime→yellow→red 계열로 매핑. */
export function lufsAdaptiveColormap(db: number, lufsLevel: number): [number, number, number] {
  const peakRedDb = -1;
  if (db >= peakRedDb) return [1, 0.06, 0.04];

  if (db >= lufsLevel) {
    const span = Math.max(peakRedDb - lufsLevel, 1);
    const t = clamp01((db - lufsLevel) / span);
    return [
      (248 + (255 - 248) * t) / 255,
      (113 + (15 - 113) * t) / 255,
      (22 + (10 - 22) * t) / 255,
    ];
  }

  const belowSpanDb = 36;
  return interpolateStops(LUFS_STOPS, (db - (lufsLevel - belowSpanDb)) / belowSpanDb);
}
