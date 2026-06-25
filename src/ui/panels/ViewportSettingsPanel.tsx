// SonicCube v0.1.0 - 뷰포트 설정 패널 (슬라이더는 store와 연동, 3D 반영은 Phase 4)
// v0.7.1: 지나온 구간(Played Region) 표시 방식 토글 추가
import { useAppStore, type Perspective, type PlayedRegionMode, type SpectralViewMode } from '../../store/appStore';

const PERSPECTIVES: { id: Perspective; label: string }[] = [
  { id: 'iso', label: 'ISO' },
  { id: 'ortho', label: 'ORTHO' },
  { id: '3d', label: '3D' },
];

const PLAYED_REGIONS: { id: PlayedRegionMode; label: string }[] = [
  { id: 'show', label: 'SHOW' },
  { id: 'fade', label: 'FADE' },
  { id: 'hide', label: 'HIDE' },
];

const SPECTRAL_VIEW_MODES: { id: SpectralViewMode; label: string }[] = [
  { id: 'analyst', label: 'ANALYST' },
  { id: 'cinema', label: 'CINEMA' },
  { id: 'water', label: 'WATER' },
];

function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant uppercase">{label}</span>
        <span className="font-label-mono-sm text-label-mono-sm text-primary">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}

export default function ViewportSettingsPanel() {
  const {
    rotationX,
    zoom,
    perspective,
    spectralViewMode,
    setRotationX,
    setZoom,
    setPerspective,
    setSpectralViewMode,
    requestViewReset,
    playedRegion,
    setPlayedRegion,
  } = useAppStore();
  return (
    <div className="glass-panel rounded-lg p-4">
      <p className="font-label-mono-sm text-label-mono-sm text-primary uppercase tracking-widest mb-3">
        Viewport Settings
      </p>
      <div className="flex flex-col gap-4">
        <Slider
          label="Rotation X"
          value={rotationX}
          display={`${rotationX}°`}
          min={0}
          max={90}
          step={1}
          onChange={setRotationX}
        />
        <Slider
          label="Zoom Level"
          value={zoom}
          display={`${zoom.toFixed(1)}x`}
          min={0.5}
          max={3}
          step={0.1}
          onChange={setZoom}
        />
        <div>
          <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant uppercase">Perspective</span>
          <div className="grid grid-cols-3 gap-1 mt-1">
            {PERSPECTIVES.map((p) => (
              <button
                key={p.id}
                onClick={() => setPerspective(p.id)}
                className={`font-label-mono-sm text-label-mono-sm py-1 rounded transition-colors ${
                  perspective === p.id
                    ? 'bg-primary text-on-primary font-bold'
                    : 'bg-secondary/20 text-secondary hover:bg-secondary/30'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant uppercase">Spectral View</span>
          <div className="grid grid-cols-3 gap-1 mt-1">
            {SPECTRAL_VIEW_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setSpectralViewMode(m.id)}
                className={`font-label-mono-sm text-label-mono-sm py-1 rounded transition-colors ${
                  spectralViewMode === m.id
                    ? 'bg-primary text-on-primary font-bold'
                    : 'bg-secondary/20 text-secondary hover:bg-secondary/30'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* v0.7.1: 지나온 구간 표시 방식 */}
        <div>
          <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant uppercase">Played Region</span>
          <div className="grid grid-cols-3 gap-1 mt-1">
            {PLAYED_REGIONS.map((r) => (
              <button
                key={r.id}
                onClick={() => setPlayedRegion(r.id)}
                className={`font-label-mono-sm text-label-mono-sm py-1 rounded transition-colors ${
                  playedRegion === r.id
                    ? 'bg-primary text-on-primary font-bold'
                    : 'bg-secondary/20 text-secondary hover:bg-secondary/30'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* v0.5.0: 뷰 리셋 */}
        <button
          onClick={requestViewReset}
          className="flex items-center justify-center gap-2 mt-1 py-1.5 rounded border border-primary/40 text-primary hover:bg-primary/5 active:scale-95 transition-all font-label-mono-sm text-label-mono-sm uppercase tracking-widest"
        >
          <span className="material-symbols-outlined text-base">restart_alt</span>
          Reset View
        </button>
      </div>
    </div>
  );
}
