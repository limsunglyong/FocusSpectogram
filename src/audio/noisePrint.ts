// SonicCube v0.10.0 - Noise Print 분석 (수동/자동 구간 기반 주파수 지문)
import type { Spectrogram } from './stft';

export interface NoisePrint {
  startTime: number;
  endTime: number;
  startFrame: number;
  endFrame: number;
  frameCount: number;
  profileDb: Float32Array;
  avgDb: number;
  peakDb: number;
}

export interface NoiseRangeCandidate {
  startTime: number;
  endTime: number;
  avgDb: number;
  peakDb: number;
  stabilityDb: number;
  scoreDb: number;
}

export const NOISE_THRESHOLD_MIN = 0;
export const NOISE_THRESHOLD_MAX = 24;
export const NOISE_SMOOTHING_MIN = 0;
export const NOISE_SMOOTHING_MAX = 8;
export const DEFAULT_NOISE_RANGE_SECONDS = 2;

function smoothProfile(profile: Float32Array, radius: number): Float32Array {
  if (radius <= 0) return profile;
  const out = new Float32Array(profile.length);
  for (let i = 0; i < profile.length; i++) {
    let sum = 0;
    let count = 0;
    const a = Math.max(0, i - radius);
    const b = Math.min(profile.length - 1, i + radius);
    for (let k = a; k <= b; k++) {
      sum += profile[k];
      count++;
    }
    out[i] = sum / Math.max(1, count);
  }
  return out;
}

export function buildNoisePrint(
  spec: Spectrogram,
  startTime: number,
  endTime: number,
  smoothingBins: number,
): NoisePrint | null {
  if (spec.frames === 0 || spec.bins === 0 || endTime <= startTime) return null;

  const duration = spec.frames * spec.timeStep;
  const safeStart = Math.max(0, Math.min(startTime, duration));
  const safeEnd = Math.max(0, Math.min(endTime, duration));
  if (safeEnd <= safeStart) return null;

  const startFrame = Math.max(0, Math.min(spec.frames - 1, Math.floor(safeStart / spec.timeStep)));
  const endFrame = Math.max(startFrame + 1, Math.min(spec.frames, Math.ceil(safeEnd / spec.timeStep)));
  const frameCount = endFrame - startFrame;
  if (frameCount <= 0) return null;

  const profile = new Float32Array(spec.bins);
  let total = 0;
  let peakDb = -Infinity;

  for (let b = 0; b < spec.bins; b++) {
    let sum = 0;
    for (let f = startFrame; f < endFrame; f++) {
      const db = spec.data[f * spec.bins + b];
      sum += db;
      if (db > peakDb) peakDb = db;
    }
    const avg = sum / frameCount;
    profile[b] = avg;
    total += avg;
  }

  const radius = Math.max(NOISE_SMOOTHING_MIN, Math.min(NOISE_SMOOTHING_MAX, Math.round(smoothingBins)));
  const profileDb = smoothProfile(profile, radius);

  return {
    startTime: safeStart,
    endTime: safeEnd,
    startFrame,
    endFrame,
    frameCount,
    profileDb,
    avgDb: total / spec.bins,
    peakDb,
  };
}

export function findQuietNoiseRange(
  spec: Spectrogram,
  preferredSeconds = DEFAULT_NOISE_RANGE_SECONDS,
): NoiseRangeCandidate | null {
  if (spec.frames === 0 || spec.bins === 0) return null;

  const windowFrames = Math.max(1, Math.min(spec.frames, Math.round(preferredSeconds / spec.timeStep)));
  let bestFrame = 0;
  let bestScore = Infinity;
  let bestAvg = 0;
  let bestPeak = -Infinity;
  let bestStability = 0;

  for (let startFrame = 0; startFrame <= spec.frames - windowFrames; startFrame++) {
    let sum = 0;
    let peakDb = -Infinity;
    const frameAverages = new Float32Array(windowFrames);

    for (let f = startFrame; f < startFrame + windowFrames; f++) {
      const row = f * spec.bins;
      let frameSum = 0;
      for (let b = 0; b < spec.bins; b++) {
        const db = spec.data[row + b];
        sum += db;
        frameSum += db;
        if (db > peakDb) peakDb = db;
      }
      frameAverages[f - startFrame] = frameSum / spec.bins;
    }

    const avgDb = sum / (windowFrames * spec.bins);
    let variance = 0;
    for (let i = 0; i < frameAverages.length; i++) {
      const d = frameAverages[i] - avgDb;
      variance += d * d;
    }
    const stabilityDb = Math.sqrt(variance / frameAverages.length);

    // 낮은 평균을 선호하되, 짧은 큰 피크와 시간 변동이 큰 구간은 노이즈 지문 후보에서 밀어낸다.
    const transientPenalty = Math.max(0, peakDb - avgDb - 28) * 1.4;
    const peakPenalty = Math.max(0, peakDb + 45) * 0.9;
    const stabilityPenalty = stabilityDb * 2.2;
    const score = avgDb + transientPenalty + peakPenalty + stabilityPenalty;

    if (score < bestScore) {
      bestScore = score;
      bestFrame = startFrame;
      bestAvg = avgDb;
      bestPeak = peakDb;
      bestStability = stabilityDb;
    }
  }

  const startTime = bestFrame * spec.timeStep;
  const endTime = Math.min(spec.frames * spec.timeStep, (bestFrame + windowFrames) * spec.timeStep);
  return { startTime, endTime, avgDb: bestAvg, peakDb: bestPeak, stabilityDb: bestStability, scoreDb: bestScore };
}
