// SonicCube v0.9.0 - EQ(이퀄라이저) 밴드 모델·기본값·주파수 응답 (EQ 오버레이/실시간 조절)
// 밴드 구성(승인): low-shelf 1 + peaking 3 + high-shelf 1 (총 5밴드) 파라메트릭.
// 오디오는 BiquadFilterNode로 실시간 필터링(player.ts), 3D 오버레이 곡선은 동일한
// Web Audio 사양 계수식으로 해석적 응답을 계산해 표시 — 둘이 정확히 일치한다.

export type EqBandType = 'lowshelf' | 'peaking' | 'highshelf';

export interface EqBand {
  id: string;
  label: string;
  type: EqBandType;
  frequency: number; // Hz
  gain: number; // dB (shelf/peaking 게인)
  q: number; // peaking에서만 사용(shelf는 사양상 Q 미사용)
}

/** 게인 표시/조절 범위 ± dB */
export const EQ_GAIN_RANGE = 18;
/** Q 조절 범위 */
export const EQ_Q_MIN = 0.1;
export const EQ_Q_MAX = 10;
/** 주파수 조절 범위 (Hz) */
export const EQ_FREQ_MIN = 20;
export const EQ_FREQ_MAX = 18000;

export const DEFAULT_EQ_BANDS: EqBand[] = [
  { id: 'low', label: 'LOW', type: 'lowshelf', frequency: 100, gain: 0, q: 0.71 },
  { id: 'lmid', label: 'L-MID', type: 'peaking', frequency: 300, gain: 0, q: 1 },
  { id: 'mid', label: 'MID', type: 'peaking', frequency: 1000, gain: 0, q: 1 },
  { id: 'hmid', label: 'H-MID', type: 'peaking', frequency: 3500, gain: 0, q: 1 },
  { id: 'high', label: 'HIGH', type: 'highshelf', frequency: 8000, gain: 0, q: 0.71 },
];

export interface EqPreset {
  id: string;
  label: string;
  description: string;
  bands: EqBand[];
}

function presetBands(gains: [number, number, number, number, number]): EqBand[] {
  return DEFAULT_EQ_BANDS.map((band, i) => ({ ...band, gain: gains[i] }));
}

export const EQ_PRESETS: EqPreset[] = [
  {
    id: 'flat',
    label: 'Flat',
    description: 'Original reference',
    bands: presetBands([0, 0, 0, 0, 0]),
  },
  {
    id: 'clean-up',
    label: 'Clean Up',
    description: 'Reduce mud, add light clarity',
    bands: presetBands([-3, -4.5, -1.5, 2.5, 2]),
  },
  {
    id: 'vocal-focus',
    label: 'Vocal Focus',
    description: 'Bring speech and vocal presence forward',
    bands: presetBands([-1.5, -3, 2.5, 4.5, 2.5]),
  },
  {
    id: 'warm-master',
    label: 'Warm Master',
    description: 'Fuller low end with softer top',
    bands: presetBands([3.5, 2, -1.5, 0, -2]),
  },
  {
    id: 'bright-detail',
    label: 'Bright Detail',
    description: 'More upper detail and air',
    bands: presetBands([-2.5, -3, 0, 3.5, 5]),
  },
];

/** 단일 밴드의 특정 주파수 응답(dB). Web Audio BiquadFilter 사양 계수식과 동일. */
export function bandMagnitudeDb(band: EqBand, freqHz: number, sampleRate: number): number {
  const { type, frequency, gain, q } = band;
  if (gain === 0) return 0; // 0dB면 unity(영향 없음)

  const A = Math.pow(10, gain / 40);
  const w0 = (2 * Math.PI * frequency) / sampleRate;
  const cosw0 = Math.cos(w0);
  const sinw0 = Math.sin(w0);

  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;

  if (type === 'peaking') {
    const alpha = sinw0 / (2 * q);
    b0 = 1 + alpha * A;
    b1 = -2 * cosw0;
    b2 = 1 - alpha * A;
    a0 = 1 + alpha / A;
    a1 = -2 * cosw0;
    a2 = 1 - alpha / A;
  } else {
    // shelf: Web Audio 사양은 Q 미사용(S=1 등가) → alpha = sin(w0)/2 * √2
    const alpha = (sinw0 / 2) * Math.SQRT2;
    const sqrtA = Math.sqrt(A);
    const twoSqrtAalpha = 2 * sqrtA * alpha;
    if (type === 'lowshelf') {
      b0 = A * (A + 1 - (A - 1) * cosw0 + twoSqrtAalpha);
      b1 = 2 * A * (A - 1 - (A + 1) * cosw0);
      b2 = A * (A + 1 - (A - 1) * cosw0 - twoSqrtAalpha);
      a0 = A + 1 + (A - 1) * cosw0 + twoSqrtAalpha;
      a1 = -2 * (A - 1 + (A + 1) * cosw0);
      a2 = A + 1 + (A - 1) * cosw0 - twoSqrtAalpha;
    } else {
      // highshelf
      b0 = A * (A + 1 + (A - 1) * cosw0 + twoSqrtAalpha);
      b1 = -2 * A * (A - 1 + (A + 1) * cosw0);
      b2 = A * (A + 1 + (A - 1) * cosw0 - twoSqrtAalpha);
      a0 = A + 1 - (A - 1) * cosw0 + twoSqrtAalpha;
      a1 = 2 * (A - 1 - (A + 1) * cosw0);
      a2 = A + 1 - (A - 1) * cosw0 - twoSqrtAalpha;
    }
  }

  // H(e^{jw}) 평가, w = 2π f / Fs.  e^{-jw} = cos w - j sin w
  const w = (2 * Math.PI * freqHz) / sampleRate;
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const cw2 = Math.cos(2 * w);
  const sw2 = Math.sin(2 * w);

  const numRe = b0 + b1 * cw + b2 * cw2;
  const numIm = -(b1 * sw + b2 * sw2);
  const denRe = a0 + a1 * cw + a2 * cw2;
  const denIm = -(a1 * sw + a2 * sw2);

  const numMag2 = numRe * numRe + numIm * numIm;
  const denMag2 = denRe * denRe + denIm * denIm;
  const mag = Math.sqrt(numMag2 / Math.max(denMag2, 1e-30));
  return 20 * Math.log10(Math.max(mag, 1e-9));
}

/** 전 밴드 합성 응답(dB). enabled=false면 전부 0dB(평탄). 캐스케이드 = dB 합산. */
export function computeEqMagnitudeDb(
  bands: EqBand[],
  freqHz: Float32Array,
  sampleRate: number,
  enabled: boolean,
): Float32Array {
  const out = new Float32Array(freqHz.length);
  if (!enabled) return out;
  for (const band of bands) {
    if (band.gain === 0) continue;
    for (let i = 0; i < freqHz.length; i++) {
      out[i] += bandMagnitudeDb(band, freqHz[i], sampleRate);
    }
  }
  return out;
}
