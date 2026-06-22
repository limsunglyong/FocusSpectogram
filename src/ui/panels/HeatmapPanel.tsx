// SonicCube v0.1.0 - 히트맵 범례 패널
const SCALE = ['-120dB', '-60dB', '-24dB', '0dB', '+6dB'];

export default function HeatmapPanel() {
  return (
    <div className="glass-panel rounded-lg p-4">
      <p className="font-label-mono-sm text-label-mono-sm text-primary uppercase tracking-widest mb-3">
        Heatmap Analyzer
      </p>
      <div className="h-3 rounded-full" style={{ background: 'linear-gradient(to right, #062c2b, #10b981, #fbbf24, #fde68a)' }} />
      <div className="flex justify-between mt-2">
        {SCALE.map((s) => (
          <span key={s} className="font-label-mono-sm text-label-mono-sm text-on-surface-variant">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
