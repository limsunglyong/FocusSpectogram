// SonicCube v0.1.0 - 전역 앱 상태 (Zustand)
// v0.2.0: 오디오 디코딩 상태 추가 (Phase 1)
// v0.3.0: STFT 분석 상태/스펙트로그램 추가 (Phase 2)
import { create } from 'zustand';
import { decodeAudioFile, AudioDecodeError, type AudioMeta } from '../audio/decoder';
import { analyzeAudio, type AnalyzeHandle } from '../audio/analyzer';
import { DEFAULT_STFT_PARAMS, type Spectrogram, type StftParams } from '../audio/stft';

export type Perspective = 'iso' | 'ortho' | '3d';
export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';
export type AnalysisStatus = 'idle' | 'analyzing' | 'done' | 'error';

let currentAnalysis: AnalyzeHandle | null = null;

interface AppState {
  // 뷰포트 설정 (Phase 4에서 3D 뷰와 연동)
  rotationX: number; // deg
  zoom: number;
  perspective: Perspective;
  setRotationX: (v: number) => void;
  setZoom: (v: number) => void;
  setPerspective: (p: Perspective) => void;

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
}

export const useAppStore = create<AppState>((set, get) => ({
  rotationX: 45,
  zoom: 1.2,
  perspective: 'iso',
  setRotationX: (v) => set({ rotationX: v }),
  setZoom: (v) => set({ zoom: v }),
  setPerspective: (p) => set({ perspective: p }),

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

  loadFile: async (file) => {
    // 이전 분석 취소
    currentAnalysis?.cancel();
    currentAnalysis = null;
    set({
      loadStatus: 'loading',
      loadError: null,
      spectrogram: null,
      analysisStatus: 'idle',
      analysisProgress: 0,
      analysisError: null,
    });
    try {
      const { buffer, meta } = await decodeAudioFile(file);
      set({ audioBuffer: buffer, meta, loadStatus: 'ready', loadError: null });

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
    set({
      audioBuffer: null,
      meta: null,
      loadStatus: 'idle',
      loadError: null,
      spectrogram: null,
      analysisStatus: 'idle',
      analysisProgress: 0,
      analysisError: null,
    });
  },
}));
