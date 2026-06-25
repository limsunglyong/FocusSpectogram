// SonicCube v0.4.0 - 스펙트로그램 → 3D 서피스 지오메트리 (Phase 3)
// 대용량 대비 시간축 max-pooling 다운샘플(최대 2000 프레임) + 주파수축 다운샘플.
// 축 매핑: X=시간, Z=주파수(깊이), Y=레벨(높이).
import * as THREE from 'three';
import type { Spectrogram } from '../audio/stft';
import { lufsAdaptiveColormap } from './colormap';

/** 사용자 승인: 시간축 최대 프레임 수. 초과 시 구간별 max-pooling 병합. */
export const MAX_FRAMES = 2000;
/** 주파수축 최대 bin 수 (메쉬 정점 수 제한용 내부 성능 캡). */
export const MAX_BINS = 512;
/** 높이 정규화 하한 (dB). 이보다 작으면 바닥(0 높이). */
export const HEIGHT_FLOOR_DB = -90;

/** 서피스 월드 치수 */
const WIDTH = 100; // X (시간)
const DEPTH = 60; // Z (주파수)
const HEIGHT = 18; // Y (레벨)

interface Downsampled {
  cols: number; // 시간 프레임 수
  rows: number; // 주파수 bin 수
  db: Float32Array; // [col * rows + row]
}

/** 시간·주파수축을 max-pooling으로 다운샘플 */
function downsample(spec: Spectrogram): Downsampled {
  const cols = Math.min(spec.frames, MAX_FRAMES);
  const rows = Math.min(spec.bins, MAX_BINS);
  const db = new Float32Array(cols * rows);
  const colScale = spec.frames / cols;
  const rowScale = spec.bins / rows;

  for (let c = 0; c < cols; c++) {
    const f0 = Math.floor(c * colScale);
    const f1 = Math.max(f0 + 1, Math.floor((c + 1) * colScale));
    for (let r = 0; r < rows; r++) {
      const b0 = Math.floor(r * rowScale);
      const b1 = Math.max(b0 + 1, Math.floor((r + 1) * rowScale));
      let peak = -Infinity;
      for (let f = f0; f < f1 && f < spec.frames; f++) {
        const base = f * spec.bins;
        for (let b = b0; b < b1 && b < spec.bins; b++) {
          const v = spec.data[base + b];
          if (v > peak) peak = v;
        }
      }
      db[c * rows + r] = peak;
    }
  }
  return { cols, rows, db };
}

export interface SurfaceBuildResult {
  geometry: THREE.BufferGeometry;
  cols: number;
  rows: number;
}

export interface SurfaceBuildOptions {
  lufsLevel?: number;
  noiseProfileDb?: Float32Array | null;
  highlightNoise?: boolean;
  noiseThresholdDb?: number;
}

/** 스펙트로그램으로부터 정점 변위 + 정점 색상 서피스 지오메트리를 생성 */
export function buildSpectrogramGeometry(spec: Spectrogram, options: SurfaceBuildOptions = {}): SurfaceBuildResult {
  const { cols, rows, db } = downsample(spec);

  const hMin = HEIGHT_FLOOR_DB;
  const hMax = Math.max(spec.maxDb, hMin + 1);
  const hRange = hMax - hMin;
  const lufsLevel = options.lufsLevel ?? -14;
  const shouldHighlightNoise = options.highlightNoise && options.noiseProfileDb && options.noiseProfileDb.length > 0;
  const noiseThreshold = options.noiseThresholdDb ?? 6;
  const rowScale = spec.bins / rows;

  const vertexCount = cols * rows;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);

  for (let c = 0; c < cols; c++) {
    const x = (cols === 1 ? 0.5 : c / (cols - 1) - 0.5) * WIDTH;
    for (let r = 0; r < rows; r++) {
      const idx = c * rows + r;
      // v0.5.2: 주파수축 방향 — 0Hz(r=0)를 z=-DEPTH/2, 고주파를 z=+DEPTH/2
      const z = (rows === 1 ? -0.5 : r / (rows - 1) - 0.5) * DEPTH;
      const norm = Math.min(1, Math.max(0, (db[idx] - hMin) / hRange));
      const y = norm * HEIGHT;

      positions[idx * 3] = x;
      positions[idx * 3 + 1] = y;
      positions[idx * 3 + 2] = z;

      let noiseMatch = false;
      if (shouldHighlightNoise) {
        const b0 = Math.floor(r * rowScale);
        const b1 = Math.max(b0 + 1, Math.floor((r + 1) * rowScale));
        let profile = -Infinity;
        for (let b = b0; b < b1 && b < options.noiseProfileDb!.length; b++) {
          if (options.noiseProfileDb![b] > profile) profile = options.noiseProfileDb![b];
        }
        noiseMatch = Number.isFinite(profile) && Math.abs(db[idx] - profile) <= noiseThreshold;
      }

      if (noiseMatch) {
        colors[idx * 3] = 0.72;
        colors[idx * 3 + 1] = 0.34;
        colors[idx * 3 + 2] = 1;
      } else {
        const [cr, cg, cb] = lufsAdaptiveColormap(db[idx], lufsLevel);
        colors[idx * 3] = cr;
        colors[idx * 3 + 1] = cg;
        colors[idx * 3 + 2] = cb;
      }
    }
  }

  // 인덱스 (셀당 2 삼각형)
  const quadCount = (cols - 1) * (rows - 1);
  const use32 = vertexCount > 65535;
  const indices = use32 ? new Uint32Array(quadCount * 6) : new Uint16Array(quadCount * 6);
  let ptr = 0;
  for (let c = 0; c < cols - 1; c++) {
    for (let r = 0; r < rows - 1; r++) {
      const a = c * rows + r;
      const b = a + 1;
      const d = a + rows;
      const e = d + 1;
      indices[ptr++] = a;
      indices[ptr++] = d;
      indices[ptr++] = b;
      indices[ptr++] = b;
      indices[ptr++] = d;
      indices[ptr++] = e;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  return { geometry, cols, rows };
}

export const SURFACE_DIMENSIONS = { WIDTH, DEPTH, HEIGHT };
