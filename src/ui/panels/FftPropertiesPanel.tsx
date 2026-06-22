// SonicCube v0.1.0 - FFT 속성 패널
// v0.2.0: 디코딩된 메타데이터(샘플레이트/비트뎁스/피크) 실제 값 바인딩 (Phase 1)
// v0.2.1: Sample Rate를 원본 헤더값으로 표시 (리샘플링된 컨텍스트 레이트 버그 수정)
import { useAppStore } from '../../store/appStore';

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
  const spec = useAppStore((s) => s.spectrogram);

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
        <Field label="Hop Size" value={`${params.hopSize}`} />
      </div>
      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-outline-variant">
        <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant">— X: TIME (S)</span>
        <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant">— Y: FREQ (KHZ)</span>
        <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant">— Z: LEVEL (DB)</span>
      </div>
      {spec && (
        <p className="mt-2 font-label-mono-sm text-label-mono-sm text-on-surface-variant/60">
          {spec.frames}×{spec.bins} · Δt {(spec.timeStep * 1000).toFixed(1)}ms · Δf {spec.freqStep.toFixed(1)}Hz
        </p>
      )}
    </div>
  );
}
