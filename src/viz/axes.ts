// SonicCube v0.5.0 - 3D 좌표축 라벨 + 눈금 스케일 (Phase 4 보완)
// v0.5.1: 주파수축 방향 반전(0Hz=원점), 축 이름을 라운드 박스+normal 폰트+축소
// 축: X=TIME(s), Z=FREQUENCY(Hz), Y=INTENSITY(dB).
// 텍스트는 canvas 텍스처 스프라이트로 렌더(항상 카메라를 향함).
import * as THREE from 'three';
import { HEIGHT_FLOOR_DB } from './surface';

export interface AxisRanges {
  duration: number; // s (X)
  maxFreq: number; // Hz (Z)
  lufsLevel?: number;
  showLufsPlane?: boolean;
  maxDb: number; // dB (Y 상단)
}

export interface AxisDims {
  WIDTH: number; // X
  DEPTH: number; // Z
  HEIGHT: number; // Y
}

const COLOR_TIME = '#fbbf24'; // gold
const COLOR_FREQ = '#10b981'; // emerald
const COLOR_INTENSITY = '#e2f3f1'; // light
const COLOR_LUFS = '#ff1f1f';
const COLOR_TICK = '#94b1af'; // on-surface-variant

const FONT_PX = 64; // 텍스처 내부 해상도(글리프 높이 기준)
const TICK_TEXT_H = 2.6; // 눈금 글자 월드 높이
const TITLE_TEXT_H = TICK_TEXT_H; // v0.5.2: 축 이름 글자 크기를 눈금과 동일하게

interface Disposable {
  texture: THREE.Texture;
  material: THREE.SpriteMaterial;
}

function fmtTime(s: number): string {
  if (s >= 60) {
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  }
  return `${s.toFixed(s < 10 ? 1 : 0)}s`;
}

function fmtFreq(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${Math.round(hz)}`;
}

function fmtDb(db: number): string {
  return `${Math.round(db)}`;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** axis group + dispose 핸들을 만든다 */
export function buildAxes(dims: AxisDims, ranges: AxisRanges) {
  const { WIDTH, DEPTH, HEIGHT } = dims;
  const group = new THREE.Group();
  const disposables: Disposable[] = [];

  // textH = 글리프(FONT_PX)의 월드 높이. boxed면 라운드 박스 배경 + 테두리.
  const makeLabel = (text: string, color: string, textH: number, boxed = false): THREE.Sprite => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const weight = 400; // normal
    ctx.font = `${weight} ${FONT_PX}px 'JetBrains Mono', monospace`;
    const textW = Math.ceil(ctx.measureText(text).width);

    const padX = boxed ? 26 : 12;
    const padY = boxed ? 16 : 10;
    canvas.width = textW + padX * 2;
    canvas.height = FONT_PX + padY * 2;

    // 리사이즈 후 컨텍스트 상태 재설정
    ctx.font = `${weight} ${FONT_PX}px 'JetBrains Mono', monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    if (boxed) {
      roundRectPath(ctx, 2, 2, canvas.width - 4, canvas.height - 4, 22);
      ctx.fillStyle = 'rgba(3, 23, 22, 0.72)'; // surface-container-lowest 기반 반투명
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = color;
      ctx.stroke();
    }

    ctx.fillStyle = color;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    // 글리프(FONT_PX)가 textH 월드 높이가 되도록 캔버스 전체를 스케일
    sprite.scale.set((textH * canvas.width) / FONT_PX, (textH * canvas.height) / FONT_PX, 1);
    disposables.push({ texture, material });
    return sprite;
  };

  const addLine = (points: THREE.Vector3[], colorHex: number) => {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.6 });
    group.add(new THREE.Line(geo, mat));
  };

  const TICKS = 5;
  const off = TICK_TEXT_H * 1.6; // 축선에서 라벨 오프셋

  // 좌표 매핑
  const xOfTime = (t: number) => -WIDTH / 2 + (ranges.duration > 0 ? t / ranges.duration : 0) * WIDTH;
  // v0.5.2: 0Hz → z=-DEPTH/2, maxFreq → z=+DEPTH/2
  const zOfFreq = (f: number) => -DEPTH / 2 + (ranges.maxFreq > 0 ? f / ranges.maxFreq : 0) * DEPTH;
  const hMin = HEIGHT_FLOOR_DB;
  const hMax = Math.max(ranges.maxDb, hMin + 1);
  const yOfDb = (d: number) => ((d - hMin) / (hMax - hMin)) * HEIGHT;

  // --- TIME 축 (X), 0Hz 원점 모서리 z=-DEPTH/2, y=0 (v0.5.3) ---
  addLine([new THREE.Vector3(-WIDTH / 2, 0, -DEPTH / 2), new THREE.Vector3(WIDTH / 2, 0, -DEPTH / 2)], 0xfbbf24);
  for (let i = 0; i <= TICKS; i++) {
    const t = (ranges.duration * i) / TICKS;
    const s = makeLabel(fmtTime(t), COLOR_TICK, TICK_TEXT_H);
    s.position.set(xOfTime(t), -off, -DEPTH / 2 - off);
    group.add(s);
  }
  {
    // 축 끝(시간 최대)에 배치
    const title = makeLabel('TIME (s)', COLOR_TIME, TITLE_TEXT_H, true);
    title.position.set(WIDTH / 2 + off * 3, -off, -DEPTH / 2);
    group.add(title);
  }

  // --- FREQUENCY 축 (Z), 왼쪽 모서리 x=-WIDTH/2, y=0 ---
  addLine([new THREE.Vector3(-WIDTH / 2, 0, -DEPTH / 2), new THREE.Vector3(-WIDTH / 2, 0, DEPTH / 2)], 0x10b981);
  for (let i = 0; i <= TICKS; i++) {
    const f = (ranges.maxFreq * i) / TICKS;
    const s = makeLabel(fmtFreq(f), COLOR_TICK, TICK_TEXT_H);
    s.position.set(-WIDTH / 2 - off, -off, zOfFreq(f));
    group.add(s);
  }
  {
    // 축 끝(주파수 최대 = z=+DEPTH/2)에 배치
    const title = makeLabel('FREQUENCY (Hz)', COLOR_FREQ, TITLE_TEXT_H, true);
    title.position.set(-WIDTH / 2 - off, -off, DEPTH / 2 + off * 3);
    group.add(title);
  }

  // --- INTENSITY 축 (Y), 원점 모서리 x=-WIDTH/2, z=-DEPTH/2 (0Hz·0s) ---
  addLine([new THREE.Vector3(-WIDTH / 2, 0, -DEPTH / 2), new THREE.Vector3(-WIDTH / 2, HEIGHT, -DEPTH / 2)], 0xe2f3f1);
  {
    const dbTicks = 4;
    for (let i = 0; i <= dbTicks; i++) {
      const d = hMin + ((hMax - hMin) * i) / dbTicks;
      const s = makeLabel(fmtDb(d), COLOR_TICK, TICK_TEXT_H);
      s.position.set(-WIDTH / 2 - off, yOfDb(d), -DEPTH / 2 - off);
      group.add(s);
    }
    // 축 끝(상단)에 배치
    const title = makeLabel('LEVEL (LUFS)', COLOR_INTENSITY, TITLE_TEXT_H, true);
    title.position.set(-WIDTH / 2 - off, HEIGHT + off * 2, -DEPTH / 2);
    group.add(title);
    if (ranges.showLufsPlane && typeof ranges.lufsLevel === 'number') {
      const lufs = makeLabel(`${Math.round(ranges.lufsLevel)} LUFS`, COLOR_LUFS, TICK_TEXT_H, true);
      lufs.position.set(-WIDTH / 2 - off * 2.6, yOfDb(ranges.lufsLevel), -DEPTH / 2 - off);
      group.add(lufs);
    }
  }

  const dispose = () => {
    group.traverse((obj) => {
      if (obj instanceof THREE.Line) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });
    for (const d of disposables) {
      d.texture.dispose();
      d.material.dispose();
    }
  };

  return { group, dispose };
}
