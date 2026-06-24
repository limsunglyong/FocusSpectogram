// SonicCube v0.1.0 - 3D 뷰포트
// v0.2.0: 드래그&드롭 입력 + 로딩/에러/빈 상태 표시 (Phase 1)
// v0.3.0: STFT 분석 진행/결과 표시 (Phase 2)
// v0.4.0: 분석 완료 시 3D 스펙트로그램 캔버스 렌더 (Phase 3)
import { useState, type DragEvent } from 'react';
import { useAppStore } from '../store/appStore';
import SpectrogramCanvas from './SpectrogramCanvas';
import FftPropertiesPanel from './panels/FftPropertiesPanel';
import ViewportSettingsPanel from './panels/ViewportSettingsPanel';
import HeatmapPanel from './panels/HeatmapPanel';
import EqPanel from './panels/EqPanel';

// v0.3.0: 디코딩 완료 후 STFT 분석 진행/결과 표시 (Phase 2)
function AnalysisState() {
  const analysisStatus = useAppStore((s) => s.analysisStatus);
  const progress = useAppStore((s) => s.analysisProgress);
  const analysisError = useAppStore((s) => s.analysisError);
  const spec = useAppStore((s) => s.spectrogram);

  if (analysisStatus === 'analyzing') {
    return (
      <div className="text-center text-on-surface-variant w-72">
        <span className="material-symbols-outlined text-6xl text-primary/50 animate-pulse">graphic_eq</span>
        <p className="mt-2 font-label-mono-sm text-label-mono-sm uppercase tracking-widest">
          FFT 분석 중 · {Math.round(progress * 100)}%
        </p>
        <div className="mt-2 h-1 w-full bg-surface-container rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    );
  }
  if (analysisStatus === 'error') {
    return (
      <div className="text-center text-error max-w-md px-6">
        <span className="material-symbols-outlined text-6xl">error</span>
        <p className="mt-2 font-label-mono-sm text-label-mono-sm">분석 실패: {analysisError}</p>
      </div>
    );
  }
  // 분석 완료 시에는 3D 캔버스가 렌더되므로 중앙 텍스트 없음
  if (analysisStatus === 'done' && spec) return null;
  return null;
}

function CenterState() {
  const loadStatus = useAppStore((s) => s.loadStatus);
  const loadError = useAppStore((s) => s.loadError);
  const meta = useAppStore((s) => s.meta);

  if (loadStatus === 'loading') {
    return (
      <div className="text-center text-on-surface-variant">
        <span className="material-symbols-outlined text-6xl text-primary/50 animate-pulse">graphic_eq</span>
        <p className="mt-2 font-label-mono-sm text-label-mono-sm uppercase tracking-widest">디코딩 중…</p>
      </div>
    );
  }
  if (loadStatus === 'error') {
    return (
      <div className="text-center text-error max-w-md px-6">
        <span className="material-symbols-outlined text-6xl">error</span>
        <p className="mt-2 font-label-mono-sm text-label-mono-sm">{loadError}</p>
        <p className="mt-1 font-label-mono-sm text-label-mono-sm text-on-surface-variant/60">
          다른 파일로 다시 시도하세요 (권장: mp3, wav)
        </p>
      </div>
    );
  }
  if (loadStatus === 'ready' && meta) {
    return <AnalysisState />;
  }
  // idle
  return (
    <div className="text-center text-on-surface-variant">
      <span className="material-symbols-outlined text-6xl text-primary/30">upload_file</span>
      <p className="mt-2 font-label-mono-sm text-label-mono-sm uppercase tracking-widest">
        오디오 파일을 드래그하거나 Upload File 클릭
      </p>
      <p className="mt-1 font-label-mono-sm text-label-mono-sm text-on-surface-variant/60">
        지원: mp3, wav (그 외 flac/ogg/m4a는 브라우저 지원 범위)
      </p>
    </div>
  );
}

export default function Viewport() {
  const loadFile = useAppStore((s) => s.loadFile);
  const showCanvas = useAppStore((s) => s.analysisStatus === 'done' && s.spectrogram !== null);
  const [dragOver, setDragOver] = useState(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void loadFile(file);
  };

  return (
    <section
      className={`flex-1 relative bg-surface-container-lowest overflow-hidden transition-colors ${
        dragOver ? 'ring-2 ring-inset ring-primary' : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {/* 3D 스펙트로그램 캔버스 (분석 완료 시) */}
      {showCanvas && <SpectrogramCanvas />}

      {/* 좌상단 패널 */}
      <div className="absolute top-4 left-4 z-10 w-72">
        <FftPropertiesPanel />
      </div>

      {/* 우상단 패널 (길어질 수 있어 세로 스크롤 허용) */}
      <div className="absolute top-4 right-4 bottom-4 z-10 w-72 flex flex-col gap-4 overflow-y-auto pr-1">
        <ViewportSettingsPanel />
        <EqPanel />
        <HeatmapPanel />
      </div>

      {/* 3D 캔버스 placeholder / 상태 표시 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <CenterState />
      </div>

      {dragOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-primary/10 backdrop-blur-sm pointer-events-none">
          <p className="font-label-mono-lg text-label-mono-lg text-primary uppercase tracking-widest">
            여기에 놓아 불러오기
          </p>
        </div>
      )}
    </section>
  );
}
