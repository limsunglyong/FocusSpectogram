// SonicCube v0.4.0 - Three.js 스펙트로그램 씬 (Phase 3)
// 씬/카메라/렌더러/OrbitControls + 서피스 메쉬 + 그리드/축.
// v0.6.0: 패널 연동용 카메라 제어 API (Rotation X / Zoom / Perspective) + 양방향 동기화 (Phase 4)
// v0.7.0: 재생 위치 플레이헤드(반투명 평면 + 바닥 라인) (Phase 5)
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Spectrogram } from '../audio/stft';
import { buildSpectrogramGeometry, SURFACE_DIMENSIONS } from './surface';
import { buildAxes } from './axes';

export type Perspective = 'iso' | 'ortho' | '3d';

// 뷰 리셋용 기본 카메라 상태
const DEFAULT_CAM_POS = new THREE.Vector3(90, 70, 90);
const DEFAULT_TARGET = new THREE.Vector3(0, SURFACE_DIMENSIONS.HEIGHT * 0.3, 0);
// 줌 매핑 기준 반경 (zoom=1.2일 때 기본 반경 ≈ 142가 되도록)
const BASE_RADIUS = 171;
const ORTHO_FRUSTUM = 150; // 정사영 수직 가시 범위(월드 단위, zoom=1 기준)
// ISO(등각) 프리셋 각도
const ISO_THETA_DEG = 45;
const ISO_ROTX_DEG = 35;

// v0.7.0: 플레이헤드 색(gold, axes COLOR_TIME과 동일 계열)
const PLAYHEAD_COLOR = 0xfbbf24;
// v0.8.1: 재생 시점 FFT 단면 강조선 색(밝은 화이트)
const SLICE_COLOR = 0xfbbf24;
// v0.9.0: EQ 오버레이 곡선 색(emerald)·표시 범위·해상도
const EQ_COLOR = 0x34d399;
const EQ_ZERO_COLOR = 0x0e8a6e; // 0dB 기준선(어두운 emerald)
const EQ_DB_RANGE = 18; // 곡선 Y 매핑 ± dB
const EQ_CURVE_POINTS = 160; // 주파수축 샘플 수

export interface CameraState {
  rotationX: number; // 0..90 (지평선 기준 올려본 각)
  zoom: number;
}

export class SpectrogramScene {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private perspCamera: THREE.PerspectiveCamera;
  private orthoCamera: THREE.OrthographicCamera;
  private activeCamera: THREE.Camera;
  private controls!: OrbitControls;
  private mesh: THREE.Mesh | null = null;
  private axisGroup: THREE.Group | null = null;
  private disposeAxes: (() => void) | null = null;
  private frameId = 0;
  private resizeObserver: ResizeObserver;
  private isOrtho = false;
  private suppressChange = false;

  // v0.7.0: 재생 플레이헤드
  private playhead: THREE.Group;
  private playheadDuration = 0; // 시간축 도메인(초) = 스펙트로그램 시간 길이
  /** 매 프레임 현재 재생 위치(초)를 반환. null이면 플레이헤드 미갱신 */
  playheadTimeProvider: (() => number) | null = null;

  // v0.8.1: 재생 시점의 FFT 스펙트럼(주파수×강도) 단면 강조선
  private sliceLine!: THREE.Line;
  private surfacePos: Float32Array | null = null; // 서피스 지오메트리 정점 좌표 참조
  private sliceCols = 0; // 서피스 시간축 열 수
  private sliceRows = 0; // 서피스 주파수축 행 수

  // v0.9.0: EQ 오버레이 곡선 (서피스 앞면 time=0 모서리, 주파수축 Z × gain dB)
  private eqLine!: THREE.Line;
  private eqZeroLine!: THREE.Line;
  private eqVisible = false;
  private eqMaxFreq = 0; // 표시 주파수 상한(Nyquist, Hz)
  private eqFreqs: Float32Array | null = null; // 샘플 주파수(Hz)
  /** 주파수 배열(Hz) → 합성 EQ 응답(dB)을 반환. null이면 곡선 미갱신 */
  eqResponseProvider: ((freqHz: Float32Array) => Float32Array) | null = null;

  // v0.7.1: 지나온 구간 표시 (0=show, 1=fade, 2=hide). 서피스 셰이더 uniform으로 적용
  private playedMode = 0;
  private surfaceUniforms: {
    uPlayheadX: { value: number };
    uPlayedMode: { value: number };
    uPlayedAlpha: { value: number };
  } | null = null;

  /** 사용자 드래그 등으로 카메라가 바뀔 때 호출 (슬라이더 동기화용) */
  onCameraChange: ((state: CameraState) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x031716); // surface-container-lowest

    this.perspCamera = new THREE.PerspectiveCamera(55, w / h, 0.1, 4000);
    this.perspCamera.position.copy(DEFAULT_CAM_POS);

    const aspect = w / h;
    this.orthoCamera = new THREE.OrthographicCamera(
      (-ORTHO_FRUSTUM * aspect) / 2,
      (ORTHO_FRUSTUM * aspect) / 2,
      ORTHO_FRUSTUM / 2,
      -ORTHO_FRUSTUM / 2,
      0.1,
      4000,
    );
    this.orthoCamera.position.copy(DEFAULT_CAM_POS);

    this.activeCamera = this.perspCamera;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    container.appendChild(this.renderer.domElement);

    this.rebuildControls();

    // 조명 (vertexColors 기반이지만 normals 음영용으로 약하게)
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dir = new THREE.DirectionalLight(0xffffff, 0.5);
    dir.position.set(60, 120, 40);
    this.scene.add(dir);

    this.addGrid();

    this.playhead = this.buildPlayhead();
    this.playhead.visible = false;
    this.scene.add(this.playhead);

    this.buildEqOverlay();

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(container);

    this.animate();
  }

  /** 활성 카메라 기준으로 OrbitControls 재생성 (정사영/원근 전환 시) */
  private rebuildControls() {
    const target = this.controls ? this.controls.target.clone() : DEFAULT_TARGET.clone();
    this.controls?.dispose();
    this.controls = new OrbitControls(this.activeCamera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.copy(target);
    this.controls.addEventListener('change', () => {
      if (this.suppressChange) return;
      this.onCameraChange?.(this.readCameraState());
    });
    this.controls.update();
  }

  private addGrid() {
    const { WIDTH, DEPTH } = SURFACE_DIMENSIONS;
    const grid = new THREE.GridHelper(Math.max(WIDTH, DEPTH), 20, 0x10b981, 0x0e4b48);
    (grid.material as THREE.Material).opacity = 0.25;
    (grid.material as THREE.Material).transparent = true;
    grid.position.y = 0;
    this.scene.add(grid);
  }

  /** v0.7.0: 플레이헤드 = 반투명 평면(주파수×강도 면) + 바닥 라인. group.position.x로 이동 */
  private buildPlayhead(): THREE.Group {
    const { DEPTH, HEIGHT } = SURFACE_DIMENSIONS;
    const group = new THREE.Group();

    // 반투명 평면: 기본 XY평면(법선 +Z)을 Y축 90° 회전 → 법선 +X, 가로=주파수(Z)·세로=강도(Y)
    const planeGeo = new THREE.PlaneGeometry(DEPTH, HEIGHT);
    planeGeo.rotateY(Math.PI / 2);
    const planeMat = new THREE.MeshBasicMaterial({
      color: PLAYHEAD_COLOR,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.position.y = HEIGHT / 2; // 0..HEIGHT 구간을 덮도록
    group.add(plane);

    // 바닥 라인: 주파수축(Z)을 따라가는 얇은 막대 (라인 두께 보장용 Box)
    const barGeo = new THREE.BoxGeometry(0.6, 0.4, DEPTH);
    const barMat = new THREE.MeshBasicMaterial({
      color: PLAYHEAD_COLOR,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.position.y = 0.2; // 바닥(grid) 살짝 위
    group.add(bar);

    // v0.8.1: 현재 재생 시점의 FFT 단면(주파수축 Z를 따라 강도 Y를 잇는) 강조선.
    // 로컬 X=0으로 두면 group.position.x(=플레이헤드 시간 위치)를 따라 이동한다.
    // setSpectrogram에서 실제 행 수만큼 position 속성을 교체한다.
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: SLICE_COLOR,
      transparent: true,
      opacity: 0.95,
      depthTest: false, // 서피스에 가려지지 않고 항상 강조되도록
    });
    const line = new THREE.Line(lineGeo, lineMat);
    line.renderOrder = 999;
    line.frustumCulled = false;
    group.add(line);
    this.sliceLine = line;

    return group;
  }

  /** v0.9.0: EQ 오버레이 — 앞면(time=0)에 주파수축을 따라 합성 응답 곡선 + 0dB 기준선 */
  private buildEqOverlay() {
    const { WIDTH, DEPTH } = SURFACE_DIMENSIONS;
    const xFront = -WIDTH / 2;

    // 0dB 기준선: 앞면을 가로지르는 직선 (주파수 0 → Nyquist)
    const zeroGeo = new THREE.BufferGeometry();
    zeroGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([xFront, this.eqGainToY(0), -DEPTH / 2, xFront, this.eqGainToY(0), DEPTH / 2]),
        3,
      ),
    );
    const zeroMat = new THREE.LineBasicMaterial({
      color: EQ_ZERO_COLOR,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
    });
    this.eqZeroLine = new THREE.Line(zeroGeo, zeroMat);
    this.eqZeroLine.renderOrder = 997;
    this.eqZeroLine.frustumCulled = false;
    this.eqZeroLine.visible = false;
    this.scene.add(this.eqZeroLine);

    // 응답 곡선: EQ_CURVE_POINTS개 정점, setSpectrogram/refresh에서 갱신
    const curveGeo = new THREE.BufferGeometry();
    curveGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(EQ_CURVE_POINTS * 3), 3));
    const curveMat = new THREE.LineBasicMaterial({
      color: EQ_COLOR,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    this.eqLine = new THREE.Line(curveGeo, curveMat);
    this.eqLine.renderOrder = 998;
    this.eqLine.frustumCulled = false;
    this.eqLine.visible = false;
    this.scene.add(this.eqLine);
  }

  /** EQ gain(dB) → 앞면 Y. 0dB=HEIGHT/2 중심, ±EQ_DB_RANGE를 ±HEIGHT/2로 매핑 */
  private eqGainToY(db: number): number {
    const { HEIGHT } = SURFACE_DIMENSIONS;
    const clamped = THREE.MathUtils.clamp(db, -EQ_DB_RANGE, EQ_DB_RANGE);
    return HEIGHT / 2 + (clamped / EQ_DB_RANGE) * (HEIGHT / 2);
  }

  /** 주파수(Hz) → Z. 서피스 매핑과 동일(0Hz=-DEPTH/2, Nyquist=+DEPTH/2) */
  private freqToZ(freqHz: number): number {
    const ratio = this.eqMaxFreq > 0 ? freqHz / this.eqMaxFreq : 0;
    return (THREE.MathUtils.clamp(ratio, 0, 1) - 0.5) * SURFACE_DIMENSIONS.DEPTH;
  }

  /** v0.9.0: EQ 오버레이 표시 토글. 표시 시 곡선 즉시 갱신 */
  setEqVisible(visible: boolean) {
    this.eqVisible = visible;
    const show = visible && this.eqMaxFreq > 0;
    this.eqLine.visible = show;
    this.eqZeroLine.visible = show;
    if (show) this.refreshEqCurve();
  }

  /** v0.9.0: 현재 밴드 응답으로 곡선 정점 재계산 (밴드 변경/표시 시 호출) */
  refreshEqCurve() {
    if (!this.eqVisible || !this.eqFreqs || !this.eqResponseProvider || this.eqMaxFreq <= 0) return;
    const db = this.eqResponseProvider(this.eqFreqs);
    const attr = this.eqLine.geometry.getAttribute('position') as THREE.BufferAttribute;
    const out = attr.array as Float32Array;
    const xFront = -SURFACE_DIMENSIONS.WIDTH / 2;
    for (let i = 0; i < this.eqFreqs.length; i++) {
      out[i * 3] = xFront;
      out[i * 3 + 1] = this.eqGainToY(db[i]);
      out[i * 3 + 2] = this.freqToZ(this.eqFreqs[i]);
    }
    attr.needsUpdate = true;
  }

  // ---- 카메라 제어 (Phase 4) ----------------------------------------------

  /** 현재 카메라의 rotationX(지평선 기준 각)·zoom을 읽는다 */
  private readCameraState(): CameraState {
    const offset = new THREE.Vector3().subVectors(this.activeCamera.position, this.controls.target);
    const sph = new THREE.Spherical().setFromVector3(offset);
    const rotationX = THREE.MathUtils.clamp(90 - THREE.MathUtils.radToDeg(sph.phi), 0, 90);
    const zoom = this.isOrtho ? this.orthoCamera.zoom : BASE_RADIUS / Math.max(sph.radius, 1e-3);
    return { rotationX, zoom };
  }

  /** 구면좌표 일부를 덮어써 카메라를 배치 */
  private setCameraSpherical(opts: { rotationXDeg?: number; zoom?: number; thetaDeg?: number }) {
    const offset = new THREE.Vector3().subVectors(this.activeCamera.position, this.controls.target);
    const sph = new THREE.Spherical().setFromVector3(offset);
    if (opts.thetaDeg !== undefined) sph.theta = THREE.MathUtils.degToRad(opts.thetaDeg);
    if (opts.rotationXDeg !== undefined) {
      const phiDeg = THREE.MathUtils.clamp(90 - opts.rotationXDeg, 1, 89);
      sph.phi = THREE.MathUtils.degToRad(phiDeg);
    }
    if (this.isOrtho) {
      sph.radius = BASE_RADIUS; // 정사영은 거리 무관, 방향만 사용
      if (opts.zoom !== undefined) {
        this.orthoCamera.zoom = THREE.MathUtils.clamp(opts.zoom, 0.1, 10);
        this.orthoCamera.updateProjectionMatrix();
      }
    } else if (opts.zoom !== undefined) {
      sph.radius = BASE_RADIUS / THREE.MathUtils.clamp(opts.zoom, 0.1, 10);
    }
    offset.setFromSpherical(sph);
    this.activeCamera.position.copy(this.controls.target).add(offset);
    this.withSuppressed(() => this.controls.update());
  }

  /** suppressChange 가드 안에서 실행 (슬라이더→씬 적용 시 onCameraChange 되먹임 방지) */
  private withSuppressed(fn: () => void) {
    this.suppressChange = true;
    fn();
    this.suppressChange = false;
  }

  setRotationX(deg: number) {
    this.setCameraSpherical({ rotationXDeg: deg });
  }

  setZoom(zoom: number) {
    this.setCameraSpherical({ zoom });
  }

  setPerspective(mode: Perspective) {
    const wantOrtho = mode === 'ortho';
    if (wantOrtho !== this.isOrtho) {
      // 카메라 방향/위치 이어받아 전환
      const from = this.activeCamera;
      const to = wantOrtho ? this.orthoCamera : this.perspCamera;
      to.position.copy(from.position);
      to.quaternion.copy(from.quaternion);
      this.isOrtho = wantOrtho;
      this.activeCamera = to;
      this.onResize();
      this.rebuildControls();
    }
    if (mode === 'iso') {
      this.setCameraSpherical({ thetaDeg: ISO_THETA_DEG, rotationXDeg: ISO_ROTX_DEG });
    }
    // '3d'는 자유 원근(현재 각도 유지), 'ortho'는 정사영 전환만 수행
    this.onCameraChange?.(this.readCameraState());
  }

  /** 카메라/타깃을 기본 뷰로 복원 */
  resetView() {
    this.activeCamera.position.copy(DEFAULT_CAM_POS);
    this.controls.target.copy(DEFAULT_TARGET);
    if (this.isOrtho) {
      this.orthoCamera.zoom = 1;
      this.orthoCamera.updateProjectionMatrix();
    }
    this.controls.update();
  }

  // -------------------------------------------------------------------------

  /** 스펙트로그램 교체 (null이면 메쉬/축 제거) */
  setSpectrogram(spec: Spectrogram | null) {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.mesh = null;
      this.surfaceUniforms = null;
    }
    if (this.axisGroup) {
      this.scene.remove(this.axisGroup);
      this.disposeAxes?.();
      this.axisGroup = null;
      this.disposeAxes = null;
    }
    if (!spec || spec.frames === 0) {
      this.playheadDuration = 0;
      this.playhead.visible = false;
      this.surfacePos = null;
      this.sliceCols = 0;
      this.sliceRows = 0;
      this.eqMaxFreq = 0;
      this.eqFreqs = null;
      this.eqLine.visible = false;
      this.eqZeroLine.visible = false;
      return;
    }

    // v0.7.0: 플레이헤드 시간 도메인 = 서피스 시간축 길이, 위치 초기화 후 표시
    this.playheadDuration = spec.frames * spec.timeStep;
    this.playhead.position.x = -SURFACE_DIMENSIONS.WIDTH / 2;
    this.playhead.visible = true;

    const { geometry, cols, rows } = buildSpectrogramGeometry(spec);

    // v0.8.1: FFT 단면 강조선용 — 서피스 정점 좌표와 격자 크기를 보관하고
    // 강조선 지오메트리를 행(주파수 bin) 수만큼 재할당한다.
    this.surfacePos = geometry.getAttribute('position').array as Float32Array;
    this.sliceCols = cols;
    this.sliceRows = rows;
    this.sliceLine.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(rows * 3), 3),
    );

    // v0.9.0: EQ 오버레이 주파수 도메인(0..Nyquist) 설정 + 곡선 갱신
    this.eqMaxFreq = spec.bins * spec.freqStep;
    const freqs = new Float32Array(EQ_CURVE_POINTS);
    for (let i = 0; i < EQ_CURVE_POINTS; i++) {
      freqs[i] = (i / (EQ_CURVE_POINTS - 1)) * this.eqMaxFreq;
    }
    this.eqFreqs = freqs;
    this.setEqVisible(this.eqVisible); // 가시성 유지하며 곡선 재계산

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.6,
      metalness: 0.1,
      flatShading: false,
      transparent: true, // v0.7.1: 지나온 구간 fade(알파) 처리용
    });
    // v0.7.1: 플레이헤드 X 기준으로 지나온 구간을 반투명/숨김 처리하는 셰이더 주입
    const uniforms = {
      uPlayheadX: { value: -SURFACE_DIMENSIONS.WIDTH / 2 },
      uPlayedMode: { value: this.playedMode },
      uPlayedAlpha: { value: 0.12 },
    };
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uPlayheadX = uniforms.uPlayheadX;
      shader.uniforms.uPlayedMode = uniforms.uPlayedMode;
      shader.uniforms.uPlayedAlpha = uniforms.uPlayedAlpha;
      shader.vertexShader =
        'varying float vSurfaceX;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\n  vSurfaceX = position.x;',
        );
      shader.fragmentShader =
        'uniform float uPlayheadX;\nuniform int uPlayedMode;\nuniform float uPlayedAlpha;\nvarying float vSurfaceX;\n' +
        shader.fragmentShader.replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
  if (uPlayedMode > 0 && vSurfaceX < uPlayheadX) {
    if (uPlayedMode == 2) discard;
    gl_FragColor.a *= uPlayedAlpha;
  }`,
        );
    };
    this.surfaceUniforms = uniforms;
    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);

    // 축 라벨/눈금 (time/frequency/intensity)
    const { group, dispose } = buildAxes(SURFACE_DIMENSIONS, {
      duration: spec.frames * spec.timeStep,
      maxFreq: spec.bins * spec.freqStep,
      maxDb: spec.maxDb,
    });
    this.axisGroup = group;
    this.disposeAxes = dispose;
    this.scene.add(group);
  }

  private onResize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    const aspect = w / h;
    this.perspCamera.aspect = aspect;
    this.perspCamera.updateProjectionMatrix();
    this.orthoCamera.left = (-ORTHO_FRUSTUM * aspect) / 2;
    this.orthoCamera.right = (ORTHO_FRUSTUM * aspect) / 2;
    this.orthoCamera.top = ORTHO_FRUSTUM / 2;
    this.orthoCamera.bottom = -ORTHO_FRUSTUM / 2;
    this.orthoCamera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private animate = () => {
    this.frameId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.updatePlayhead();
    this.renderer.render(this.scene, this.activeCamera);
  };

  /** v0.7.0: 현재 재생 위치를 시간축 X 좌표로 변환해 플레이헤드 이동 */
  private updatePlayhead() {
    if (!this.playhead.visible || !this.playheadTimeProvider || this.playheadDuration <= 0) return;
    const t = this.playheadTimeProvider();
    const ratio = THREE.MathUtils.clamp(t / this.playheadDuration, 0, 1);
    const x = (ratio - 0.5) * SURFACE_DIMENSIONS.WIDTH;
    this.playhead.position.x = x;
    // v0.7.1: 지나온 구간 셰이더에 플레이헤드 X 전달
    if (this.surfaceUniforms) this.surfaceUniforms.uPlayheadX.value = x;
    // v0.8.1: 현재 시점의 FFT 단면 강조선 갱신
    this.updateSliceLine(ratio);
  }

  /** v0.8.1: 재생 비율(0..1)에 해당하는 시간 열의 서피스 단면으로 강조선을 갱신 */
  private updateSliceLine(ratio: number) {
    if (!this.surfacePos || this.sliceCols === 0) return;
    const rows = this.sliceRows;
    const c = Math.round(ratio * (this.sliceCols - 1));
    const attr = this.sliceLine.geometry.getAttribute('position') as THREE.BufferAttribute;
    const out = attr.array as Float32Array;
    const base = c * rows; // 해당 시간 열의 첫 정점 인덱스
    for (let r = 0; r < rows; r++) {
      const si = (base + r) * 3;
      out[r * 3] = 0; // 로컬 X=0 (group.position.x가 시간 위치를 담당)
      out[r * 3 + 1] = this.surfacePos[si + 1]; // Y = 강도
      out[r * 3 + 2] = this.surfacePos[si + 2]; // Z = 주파수
    }
    attr.needsUpdate = true;
  }

  /** v0.7.1: 지나온 구간 표시 방식 (0=show, 1=fade, 2=hide) */
  setPlayedMode(mode: number) {
    this.playedMode = mode;
    if (this.surfaceUniforms) this.surfaceUniforms.uPlayedMode.value = mode;
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.setSpectrogram(null);
    // v0.9.0: EQ 오버레이 정리
    this.eqLine.geometry.dispose();
    (this.eqLine.material as THREE.Material).dispose();
    this.eqZeroLine.geometry.dispose();
    (this.eqZeroLine.material as THREE.Material).dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
