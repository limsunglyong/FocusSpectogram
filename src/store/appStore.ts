// SonicCube v0.1.0 - 전역 앱 상태 (Zustand)
// v0.2.0: 오디오 디코딩 상태 추가 (Phase 1)
// v0.3.0: STFT 분석 상태/스펙트로그램 추가 (Phase 2)
// v0.7.0: 재생/트랜스포트 상태 추가 (Phase 5)
import { create } from 'zustand';
import { decodeAudioFile, AudioDecodeError, type AudioMeta } from '../audio/decoder';
import { analyzeAudio, type AnalyzeHandle } from '../audio/analyzer';
import { DEFAULT_STFT_PARAMS, type Spectrogram, type StftParams } from '../audio/stft';
import { player } from '../audio/player';
import { DEFAULT_EQ_BANDS, type EqBand } from '../audio/eq';

export type Perspective = 'iso' | 'ortho' | '3d';
export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';
export type AnalysisStatus = 'idle' | 'analyzing' | 'done' | 'error';
// v0.7.1: 플레이헤드가 지나온 구간의 표시 방식
export type PlayedRegionMode = 'show' | 'fade' | 'hide';

let currentAnalysis: AnalyzeHandle | null = null;

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
  meta: AudioMeta | null;
  loadStatus: LoadStatus;
  loadError: string | null;
  loadFile: (file: File) => Promise<void>;
  clearAudio: () => void;

  // 분석 (Phase 2)
  stftParams: StftParams;
  spectrogram: Spectrogram | null;
  analysisStatus: AnalysisStatus;
  analysisProgress: number; // 0..1
  analysisError: string | null;

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
  setEqEnabled: (b: boolean) => void;
  setEqBand: (id: string, patch: Partial<EqBand>) => void;
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
  meta: null,
  loadStatus: 'idle',
  loadError: null,

  stftParams: DEFAULT_STFT_PARAMS,
  spectrogram: null,
  analysisStatus: 'idle',
  analysisProgress: 0,
  analysisError: null,

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
  setEqEnabled: (b) => {
    player.setEqEnabled(b);
    set({ eqEnabled: b });
  },
  setEqBand: (id, patch) => {
    const bands = get().eqBands.map((b) => (b.id === id ? { ...b, ...patch } : b));
    player.setEqBands(bands);
    set({ eqBands: bands });
  },
  resetEq: () => {
    const bands = DEFAULT_EQ_BANDS.map((b) => ({ ...b }));
    player.setEqBands(bands);
    set({ eqBands: bands });
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
      isPlaying: false,
      duration: 0,
    });
    try {
      const { buffer, meta } = await decodeAudioFile(file);
      player.load(buffer);
      set({ audioBuffer: buffer, meta, loadStatus: 'ready', loadError: null, duration: buffer.duration });

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
      meta: null,
      loadStatus: 'idle',
      loadError: null,
      spectrogram: null,
      analysisStatus: 'idle',
      analysisProgress: 0,
      analysisError: null,
      isPlaying: false,
      duration: 0,
    });
  },
}));

// 플레이어 → 스토어 상태 동기화 (재생/정지·자연 종료를 isPlaying에 반영)
player.onStateChange = (playing) => useAppStore.setState({ isPlaying: playing });
