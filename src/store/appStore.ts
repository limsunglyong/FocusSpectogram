// SonicCube v0.1.0 - 전역 앱 상태 (Zustand)
// v0.2.0: 오디오 디코딩 상태 추가 (Phase 1)
// v0.3.0: STFT 분석 상태/스펙트로그램 추가 (Phase 2)
// v0.7.0: 재생/트랜스포트 상태 추가 (Phase 5)
import { create } from 'zustand';
import { decodeAudioFile, AudioDecodeError, type AudioMeta } from '../audio/decoder';
import { analyzeAudio, type AnalyzeHandle } from '../audio/analyzer';
import { DEFAULT_STFT_PARAMS, type Spectrogram, type StftParams } from '../audio/stft';
import { player } from '../audio/player';
import { DEFAULT_EQ_BANDS, EQ_PRESETS, type EqBand } from '../audio/eq';
import {
  DEFAULT_NOISE_RANGE_SECONDS,
  buildNoisePrint,
  findQuietNoiseRange,
  type NoisePrint,
  type NoiseRangeCandidate,
} from '../audio/noisePrint';
import { reduceNoiseBuffer } from '../audio/noiseReduction';

export type Perspective = 'iso' | 'ortho' | '3d';
export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';
export type AnalysisStatus = 'idle' | 'analyzing' | 'done' | 'error';
export type NoiseReductionStatus = 'idle' | 'processing' | 'done' | 'error';
// v0.7.1: 플레이헤드가 지나온 구간의 표시 방식
export type PlayedRegionMode = 'show' | 'fade' | 'hide';

let currentAnalysis: AnalyzeHandle | null = null;

function analyzeAndCommit(
  buffer: AudioBuffer,
  params: StftParams,
  set: (patch: Partial<AppState>) => void,
  isCurrent: () => boolean,
) {
  set({ analysisStatus: 'analyzing', analysisProgress: 0, analysisError: null });
  const handle = analyzeAudio(buffer, params, (p) => set({ analysisProgress: p }));
  currentAnalysis = handle;
  return handle.promise
    .then((spectrogram) => {
      if (currentAnalysis === handle && isCurrent()) {
        set({ spectrogram, analysisStatus: 'done', analysisProgress: 1 });
        currentAnalysis = null;
      }
    })
    .catch((err) => {
      if (currentAnalysis === handle && isCurrent()) {
        const message = err instanceof Error ? err.message : '분석에 실패했습니다.';
        set({ analysisStatus: 'error', analysisError: message });
        currentAnalysis = null;
      }
    });
}

interface AppState {
  // 뷰포트 설정 (Phase 4에서 3D 뷰와 연동)
  rotationX: number; // deg
  zoom: number;
  perspective: Perspective;
  setRotationX: (v: number) => void;
  setZoom: (v: number) => void;
  setPerspective: (p: Perspective) => void;

  // v0.7.1: 지나온 구간 표시 방식 (show=그대로, fade=반투명, hide=숨김)
  playedRegion: PlayedRegionMode;
  setPlayedRegion: (m: PlayedRegionMode) => void;

  // v0.5.0: 뷰 리셋 신호 (증가 시 캔버스가 카메라를 기본 뷰로 복원)
  viewResetNonce: number;
  requestViewReset: () => void;

  // 오디오 (Phase 1)
  audioBuffer: AudioBuffer | null;
  originalAudioBuffer: AudioBuffer | null;
  meta: AudioMeta | null;
  loadStatus: LoadStatus;
  loadError: string | null;
  loadFile: (file: File) => Promise<void>;
  clearAudio: () => void;

  // 분석 (Phase 2)
  stftParams: StftParams;
  setStftParams: (params: Partial<StftParams>) => void;
  spectrogram: Spectrogram | null;
  analysisStatus: AnalysisStatus;
  analysisProgress: number; // 0..1
  analysisError: string | null;
  lufsLevel: number;
  showLufsPlane: boolean;
  setLufsLevel: (level: number) => void;
  setShowLufsPlane: (show: boolean) => void;

  // Noise Print (v0.10.0) — 수동 구간 기반 노이즈 지문 도식화
  noisePrint: NoisePrint | null;
  showNoisePrint: boolean;
  noiseThresholdDb: number;
  noiseSmoothingBins: number;
  noiseRangeStart: number;
  noiseRangeEnd: number;
  noiseRangeCandidate: NoiseRangeCandidate | null;
  noisePrintError: string | null;
  noiseReductionStatus: NoiseReductionStatus;
  noiseReductionProgress: number;
  noiseReductionError: string | null;
  noiseReductionAmount: number;
  noiseReductionFloor: number;
  noiseReductionApplied: boolean;
  captureNoisePrint: () => void;
  findQuietNoiseRange: () => void;
  clearNoisePrint: () => void;
  applyNoiseReduction: () => Promise<void>;
  restoreOriginalAudio: () => Promise<void>;
  setNoiseRange: (startTime: number, endTime: number) => void;
  setShowNoisePrint: (show: boolean) => void;
  setNoiseThresholdDb: (db: number) => void;
  setNoiseSmoothingBins: (bins: number) => void;
  setNoiseReductionPresetAmount: (amount: number) => void;
  setNoiseReductionAmount: (amount: number) => void;
  setNoiseReductionFloor: (floor: number) => void;

  // 재생 (Phase 5)
  isPlaying: boolean;
  isLooping: boolean;
  volume: number; // 0..1
  duration: number; // 초 (재생 버퍼 길이)
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  stop: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  toggleLoop: () => void;

  // EQ (v0.9.0) — 실시간 BiquadFilter + 3D 오버레이 곡선
  eqEnabled: boolean;
  eqBands: EqBand[];
  eqPresetId: string;
  setEqEnabled: (b: boolean) => void;
  setEqBand: (id: string, patch: Partial<EqBand>) => void;
  applyEqPreset: (id: string) => void;
  resetEq: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  rotationX: 45,
  zoom: 1.2,
  perspective: 'iso',
  setRotationX: (v) => set({ rotationX: v }),
  setZoom: (v) => set({ zoom: v }),
  setPerspective: (p) => set({ perspective: p }),

  playedRegion: 'show',
  setPlayedRegion: (m) => set({ playedRegion: m }),

  viewResetNonce: 0,
  requestViewReset: () => set((s) => ({ viewResetNonce: s.viewResetNonce + 1 })),

  audioBuffer: null,
  originalAudioBuffer: null,
  meta: null,
  loadStatus: 'idle',
  loadError: null,

  stftParams: DEFAULT_STFT_PARAMS,
  setStftParams: (params) => {
    currentAnalysis?.cancel();
    currentAnalysis = null;

    const nextParams = { ...get().stftParams, ...params };
    const audioBuffer = get().audioBuffer;
    set({
      stftParams: nextParams,
      spectrogram: null,
      analysisStatus: audioBuffer ? 'analyzing' : 'idle',
      analysisProgress: 0,
      analysisError: null,
    });

    if (!audioBuffer) return;

    const handle = analyzeAudio(audioBuffer, nextParams, (p) => set({ analysisProgress: p }));
    currentAnalysis = handle;
    handle.promise
      .then((spectrogram) => {
        if (currentAnalysis === handle) {
          set({ spectrogram, analysisStatus: 'done', analysisProgress: 1 });
          currentAnalysis = null;
        }
      })
      .catch((err) => {
        if (currentAnalysis === handle) {
          const message = err instanceof Error ? err.message : '遺꾩꽍???ㅽ뙣?덉뒿?덈떎.';
          set({ analysisStatus: 'error', analysisError: message });
          currentAnalysis = null;
        }
      });
  },
  spectrogram: null,
  analysisStatus: 'idle',
  analysisProgress: 0,
  analysisError: null,
  lufsLevel: -14,
  showLufsPlane: false,
  setLufsLevel: (level) => set({ lufsLevel: level }),
  setShowLufsPlane: (show) => set({ showLufsPlane: show }),

  noisePrint: null,
  showNoisePrint: true,
  noiseThresholdDb: 6,
  noiseSmoothingBins: 2,
  noiseRangeStart: 0,
  noiseRangeEnd: DEFAULT_NOISE_RANGE_SECONDS,
  noiseRangeCandidate: null,
  noisePrintError: null,
  noiseReductionStatus: 'idle',
  noiseReductionProgress: 0,
  noiseReductionError: null,
  noiseReductionAmount: 0.7,
  noiseReductionFloor: 0.18,
  noiseReductionApplied: false,
  captureNoisePrint: () => {
    const spec = get().spectrogram;
    if (!spec) {
      set({ noisePrintError: '먼저 오디오 분석을 완료하세요.' });
      return;
    }
    const { noiseRangeStart, noiseRangeEnd } = get();
    const startTime = Math.min(noiseRangeStart, noiseRangeEnd);
    const endTime = Math.max(noiseRangeStart, noiseRangeEnd);
    const print = buildNoisePrint(spec, startTime, endTime, get().noiseSmoothingBins);
    if (!print) {
      set({ noisePrint: null, noisePrintError: '유효한 노이즈 구간을 선택하세요.' });
      return;
    }
    set({ noisePrint: print, showNoisePrint: true, noisePrintError: null });
  },
  findQuietNoiseRange: () => {
    const spec = get().spectrogram;
    if (!spec) {
      set({ noisePrintError: '먼저 오디오 분석을 완료하세요.' });
      return;
    }
    const found = findQuietNoiseRange(spec, DEFAULT_NOISE_RANGE_SECONDS);
    if (!found) {
      set({ noisePrintError: '조용한 구간을 찾을 수 없습니다.' });
      return;
    }
    set({
      noiseRangeStart: found.startTime,
      noiseRangeEnd: found.endTime,
      noiseRangeCandidate: found,
      noisePrintError: null,
    });
  },
  clearNoisePrint: () => set({ noisePrint: null, noisePrintError: null }),
  applyNoiseReduction: async () => {
    const source = get().audioBuffer;
    const print = get().noisePrint;
    if (!source || !print) {
      set({ noiseReductionError: '먼저 노이즈 프린트를 캡처하세요.', noiseReductionStatus: 'error' });
      return;
    }

    currentAnalysis?.cancel();
    currentAnalysis = null;
    player.pause();
    set({
      noiseReductionStatus: 'processing',
      noiseReductionProgress: 0,
      noiseReductionError: null,
      spectrogram: null,
      analysisStatus: 'idle',
      analysisProgress: 0,
      analysisError: null,
    });

    try {
      const original = get().originalAudioBuffer ?? source;
      const reduced = await reduceNoiseBuffer(
        source,
        print,
        get().stftParams,
        {
          thresholdDb: get().noiseThresholdDb,
          amount: get().noiseReductionAmount,
          floor: get().noiseReductionFloor,
        },
        (p) => set({ noiseReductionProgress: p }),
      );
      player.load(reduced);
      set({
        audioBuffer: reduced,
        originalAudioBuffer: original,
        duration: reduced.duration,
        noiseReductionStatus: 'done',
        noiseReductionProgress: 1,
        noiseReductionApplied: true,
        isPlaying: false,
      });
      await analyzeAndCommit(reduced, get().stftParams, set, () => get().audioBuffer === reduced);
    } catch (err) {
      const message = err instanceof Error ? err.message : '노이즈 감소 처리에 실패했습니다.';
      set({ noiseReductionStatus: 'error', noiseReductionError: message });
    }
  },
  restoreOriginalAudio: async () => {
    const original = get().originalAudioBuffer;
    if (!original) return;

    currentAnalysis?.cancel();
    currentAnalysis = null;
    player.pause();
    player.load(original);
    set({
      audioBuffer: original,
      originalAudioBuffer: null,
      duration: original.duration,
      spectrogram: null,
      analysisStatus: 'idle',
      analysisProgress: 0,
      analysisError: null,
      noiseReductionStatus: 'idle',
      noiseReductionProgress: 0,
      noiseReductionError: null,
      noiseReductionApplied: false,
      isPlaying: false,
    });
    await analyzeAndCommit(original, get().stftParams, set, () => get().audioBuffer === original);
  },
  setNoiseRange: (startTime, endTime) => {
    const duration = get().duration;
    const a = Math.max(0, Math.min(startTime, duration));
    const b = Math.max(0, Math.min(endTime, duration));
    set({ noiseRangeStart: Math.min(a, b), noiseRangeEnd: Math.max(a, b), noiseRangeCandidate: null, noisePrintError: null });
  },
  setShowNoisePrint: (show) => set({ showNoisePrint: show }),
  setNoiseThresholdDb: (db) => set({ noiseThresholdDb: db }),
  setNoiseSmoothingBins: (bins) => {
    const next = Math.max(0, Math.round(bins));
    const spec = get().spectrogram;
    const current = get().noisePrint;
    set({ noiseSmoothingBins: next });
    if (spec && current) {
      const print = buildNoisePrint(spec, current.startTime, current.endTime, next);
      if (print) set({ noisePrint: print });
    }
  },
  setNoiseReductionPresetAmount: (amount) => {
    const next = Math.max(0, Math.min(1, amount));
    set({
      noiseReductionAmount: next,
      noiseReductionFloor: Math.max(0, Math.min(0.6, (1 - next) * 0.6)),
    });
  },
  setNoiseReductionAmount: (amount) => set({ noiseReductionAmount: Math.max(0, Math.min(1, amount)) }),
  setNoiseReductionFloor: (floor) => set({ noiseReductionFloor: Math.max(0, Math.min(0.6, floor)) }),

  isPlaying: false,
  isLooping: false,
  volume: 1,
  duration: 0,
  play: () => player.play(),
  pause: () => player.pause(),
  togglePlay: () => (get().isPlaying ? player.pause() : player.play()),
  stop: () => player.stop(),
  seek: (t) => {
    player.seek(t);
    // 정지 중 seek는 상태 변화 콜백이 없으므로 즉시 위치를 반영하도록 강제 렌더 트리거
    set({ duration: get().duration });
  },
  setVolume: (v) => {
    player.setVolume(v);
    set({ volume: v });
  },
  toggleLoop: () => {
    const next = !get().isLooping;
    player.setLoop(next);
    set({ isLooping: next });
  },

  // EQ (v0.9.0)
  eqEnabled: false,
  eqBands: DEFAULT_EQ_BANDS.map((b) => ({ ...b })),
  eqPresetId: 'flat',
  setEqEnabled: (b) => {
    player.setEqEnabled(b);
    set({ eqEnabled: b });
  },
  setEqBand: (id, patch) => {
    const bands = get().eqBands.map((b) => (b.id === id ? { ...b, ...patch } : b));
    player.setEqBands(bands);
    set({ eqBands: bands, eqPresetId: 'custom' });
  },
  applyEqPreset: (id) => {
    const preset = EQ_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const bands = preset.bands.map((b) => ({ ...b }));
    player.setEqBands(bands);
    set({ eqBands: bands, eqPresetId: preset.id });
  },
  resetEq: () => {
    const bands = DEFAULT_EQ_BANDS.map((b) => ({ ...b }));
    player.setEqBands(bands);
    set({ eqBands: bands, eqPresetId: 'flat' });
  },

  loadFile: async (file) => {
    // 이전 분석 취소
    currentAnalysis?.cancel();
    currentAnalysis = null;
    player.stop();
    set({
      loadStatus: 'loading',
      loadError: null,
      spectrogram: null,
      analysisStatus: 'idle',
      analysisProgress: 0,
      analysisError: null,
      noisePrint: null,
      noiseRangeStart: 0,
      noiseRangeEnd: 0,
      noiseRangeCandidate: null,
      noisePrintError: null,
      noiseReductionStatus: 'idle',
      noiseReductionProgress: 0,
      noiseReductionError: null,
      noiseReductionApplied: false,
      isPlaying: false,
      duration: 0,
    });
    try {
      const { buffer, meta } = await decodeAudioFile(file);
      player.load(buffer);
      set({
        audioBuffer: buffer,
        originalAudioBuffer: null,
        meta,
        loadStatus: 'ready',
        loadError: null,
        duration: buffer.duration,
        noiseRangeStart: 0,
        noiseRangeEnd: Math.min(DEFAULT_NOISE_RANGE_SECONDS, buffer.duration),
        noiseRangeCandidate: null,
      });

      // 디코딩 성공 → 자동 분석 시작
      set({ analysisStatus: 'analyzing', analysisProgress: 0, analysisError: null });
      const handle = analyzeAudio(buffer, get().stftParams, (p) => set({ analysisProgress: p }));
      currentAnalysis = handle;
      try {
        const spectrogram = await handle.promise;
        if (currentAnalysis === handle) {
          set({ spectrogram, analysisStatus: 'done', analysisProgress: 1 });
          currentAnalysis = null;
        }
      } catch (err) {
        if (currentAnalysis === handle) {
          const message = err instanceof Error ? err.message : '분석에 실패했습니다.';
          set({ analysisStatus: 'error', analysisError: message });
          currentAnalysis = null;
        }
      }
    } catch (err) {
      const message =
        err instanceof AudioDecodeError ? err.message : '알 수 없는 오류로 파일을 불러오지 못했습니다.';
      set({ audioBuffer: null, meta: null, loadStatus: 'error', loadError: message });
    }
  },

  clearAudio: () => {
    currentAnalysis?.cancel();
    currentAnalysis = null;
    player.load(null);
    set({
      audioBuffer: null,
      originalAudioBuffer: null,
      meta: null,
      loadStatus: 'idle',
      loadError: null,
      spectrogram: null,
      analysisStatus: 'idle',
      analysisProgress: 0,
      analysisError: null,
      noisePrint: null,
      noiseRangeStart: 0,
      noiseRangeEnd: 0,
      noiseRangeCandidate: null,
      noisePrintError: null,
      noiseReductionStatus: 'idle',
      noiseReductionProgress: 0,
      noiseReductionError: null,
      noiseReductionApplied: false,
      isPlaying: false,
      duration: 0,
    });
  },
}));

// 플레이어 → 스토어 상태 동기화 (재생/정지·자연 종료를 isPlaying에 반영)
player.onStateChange = (playing) => useAppStore.setState({ isPlaying: playing });
