// SonicCube v0.1.0 - FFT 속성 패널
// v0.2.0: 디코딩된 메타데이터(샘플레이트/비트뎁스/피크) 실제 값 바인딩 (Phase 1)
// v0.2.1: Sample Rate를 원본 헤더값으로 표시 (리샘플링된 컨텍스트 레이트 버그 수정)
import { useAppStore } from '../../store/appStore';

const HOP_SIZE_OPTIONS = [128, 256, 512, 1024, 2048];
const LUFS_LEVEL_OPTIONS = [-6, -9, -12, -14, -16, -18, -23, -27, -30, -36, -40];

function Field({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="font-label-mono-sm text-label-mono-sm text-on-surface-variant uppercase">{label}</p>
      <p className={`font-label-mono-lg text-label-mono-lg ${accent ? 'text-secondary' : 'text-on-surface'}`}>{value}</p>
    </div>
  );
}

export default function FftPropertiesPanel() {
  const meta = useAppStore((s) => s.meta);
  const loadStatus = useAppStore((s) => s.loadStatus);
  const ready = loadStatus === 'ready' && meta;

  const sampleRate = ready
    ? `${meta.sampleRateIsOriginal ? '' : '≈'}${(meta.sampleRate / 1000).toFixed(1)} kHz`
    : '— kHz';
  const bitDepth = ready ? meta.bitDepthLabel : '—';
  const peak = ready
    ? meta.peakDb === -Infinity
      ? '-∞ dBFS'
      : `${meta.peakDb.toFixed(1)} dBFS`
    : '— dBFS';

  // v0.3.0: 분석 상태에 따른 배지 + Window/FFT 정보 바인딩 (Phase 2)
  const analysisStatus = useAppStore((s) => s.analysisStatus);
  const params = useAppStore((s) => s.stftParams);
  const setStftParams = useAppStore((s) => s.setStftParams);
  const lufsLevel = useAppStore((s) => s.lufsLevel);
  const showLufsPlane = useAppStore((s) => s.showLufsPlane);
  const setLufsLevel = useAppStore((s) => s.setLufsLevel);
  const setShowLufsPlane = useAppStore((s) => s.setShowLufsPlane);
  const spec = useAppStore((s) => s.spectrogram);
  const hopDisabled = loadStatus === 'loading' || analysisStatus === 'analyzing';

  const status =
    analysisStatus === 'analyzing'
      ? 'ANALYZING'
      : loadStatus === 'ready'
        ? 'STABLE'
        : loadStatus === 'loading'
          ? 'BUSY'
          : loadStatus === 'error'
            ? 'ERROR'
            : 'IDLE';
  const statusColor =
    analysisStatus === 'analyzing'
      ? 'text-primary border-primary/40'
      : loadStatus === 'ready'
        ? 'text-secondary border-secondary/40'
        : loadStatus === 'error'
          ? 'text-error border-error/40'
          : 'text-on-surface-variant border-outline-variant';

  return (
    <div className="glass-panel inner-glow-gold rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-label-mono-sm text-label-mono-sm text-primary uppercase tracking-widest">FFT Properties</p>
        <span className={`font-label-mono-sm text-label-mono-sm border rounded px-2 py-0.5 ${statusColor}`}>{status}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sample Rate" value={sampleRate} />
        <Field label="Bit Depth" value={bitDepth} />
        <Field label="Window" value={params.window.toUpperCase()} />
        <Field label="Peak Level" value={peak} accent />
        <Field label="FFT Size" value={`${params.fftSize}`} />
        <div>
          <label
            htmlFor="hop-size-select"
            className="block font-label-mono-sm text-label-mono-sm text-on-surface-variant uppercase"
          >
            Hop Size
          </label>
          <select
            id="hop-size-select"
            value={params.hopSize}
            disabled={hopDisabled}
            onChange={(e) => setStftParams({ hopSize: Number(e.target.value) })}
            className="mt-1 w-full rounded border border-primary/30 bg-background/60 px-2 py-1 font-label-mono-lg text-label-mono-lg text-on-surface outline-none transition-colors hover:border-primary/60 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {HOP_SIZE_OPTIONS.map((hopSize) => (
              <option key={hopSize} value={hopSize}>
                {hopSize}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="lufs-level-select"
            className="block font-label-mono-sm text-label-mono-sm text-on-surface-variant uppercase"
          >
            LUFS Level
          </label>
          <select
            id="lufs-level-select"
            value={lufsLevel}
            onChange={(e) => setLufsLevel(Number(e.target.value))}
            className="mt-1 w-full rounded border border-primary/30 bg-background/60 px-2 py-1 font-label-mono-lg text-label-mono-lg text-on-surface outline-none transition-colors hover:border-primary/60 focus:border-primary"
          >
            {LUFS_LEVEL_OPTIONS.map((level) => (
              <option key={level} value={level}>
                {level} LUFS
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 self-end rounded border border-primary/30 bg-secondary/10 px-2 py-1.5 font-label-mono-sm text-label-mono-sm text-on-surface-variant uppercase">
          <input
            type="checkbox"
            checked={showLufsPlane}
            onChange={(e) => setShowLufsPlane(e.target.checked)}
            className="accent-primary"
          />
          LUFS Plane
        </label>
      </div>
      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-outline-variant">
        <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant">— X: TIME (S)</span>
        <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant">— Y: FREQ (KHZ)</span>
        <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant">— Z: LEVEL (LUFS)</span>
      </div>
      {spec && (
        <p className="mt-2 font-label-mono-sm text-label-mono-sm text-on-surface-variant/60">
          {spec.frames}×{spec.bins} · Δt {(spec.timeStep * 1000).toFixed(1)}ms · Δf {spec.freqStep.toFixed(1)}Hz
        </p>
      )}
    </div>
  );
}
