// SonicCube v0.9.0 - EQ 패널 (실시간 BiquadFilter 조절 + 3D 오버레이 곡선)
// 밴드: low-shelf 1 + peaking 3 + high-shelf 1. 게인/주파수/Q 슬라이더.
import {
  EQ_GAIN_RANGE,
  EQ_FREQ_MIN,
  EQ_FREQ_MAX,
  EQ_Q_MIN,
  EQ_Q_MAX,
  type EqBand,
} from '../../audio/eq';
import { useAppStore } from '../../store/appStore';

function fmtFreq(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)}k` : `${Math.round(hz)}`;
}

function MiniSlider({
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
    <div className="flex items-center gap-2">
      <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant/70 w-8 shrink-0">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-primary"
      />
      <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant w-12 shrink-0 text-right">
        {display}
      </span>
    </div>
  );
}

function BandCard({ band, onChange }: { band: EqBand; onChange: (patch: Partial<EqBand>) => void }) {
  return (
    <div className="rounded-md border border-secondary/15 bg-secondary/5 p-2 flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline">
        <span className="font-label-mono-sm text-label-mono-sm text-secondary uppercase tracking-wider">
          {band.label}
        </span>
        <span className="font-label-mono-sm text-label-mono-sm text-primary">
          {band.gain > 0 ? '+' : ''}
          {band.gain.toFixed(1)} dB
        </span>
      </div>
      <MiniSlider
        label="GAIN"
        value={band.gain}
        display={`${band.gain > 0 ? '+' : ''}${band.gain.toFixed(1)}`}
        min={-EQ_GAIN_RANGE}
        max={EQ_GAIN_RANGE}
        step={0.5}
        onChange={(v) => onChange({ gain: v })}
      />
      <MiniSlider
        label="FREQ"
        value={band.frequency}
        display={`${fmtFreq(band.frequency)}Hz`}
        min={EQ_FREQ_MIN}
        max={EQ_FREQ_MAX}
        step={10}
        onChange={(v) => onChange({ frequency: v })}
      />
      {band.type === 'peaking' && (
        <MiniSlider
          label="Q"
          value={band.q}
          display={band.q.toFixed(2)}
          min={EQ_Q_MIN}
          max={EQ_Q_MAX}
          step={0.05}
          onChange={(v) => onChange({ q: v })}
        />
      )}
    </div>
  );
}

export default function EqPanel() {
  const eqEnabled = useAppStore((s) => s.eqEnabled);
  const eqBands = useAppStore((s) => s.eqBands);
  const setEqEnabled = useAppStore((s) => s.setEqEnabled);
  const setEqBand = useAppStore((s) => s.setEqBand);
  const resetEq = useAppStore((s) => s.resetEq);

  return (
    <div className="glass-panel rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <p className="font-label-mono-sm text-label-mono-sm text-primary uppercase tracking-widest">
          Equalizer
        </p>
        <button
          onClick={() => setEqEnabled(!eqEnabled)}
          className={`font-label-mono-sm text-label-mono-sm px-2 py-0.5 rounded transition-colors ${
            eqEnabled
              ? 'bg-primary text-on-primary font-bold'
              : 'bg-secondary/20 text-secondary hover:bg-secondary/30'
          }`}
        >
          {eqEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className={`flex flex-col gap-2 transition-opacity ${eqEnabled ? '' : 'opacity-50'}`}>
        {eqBands.map((band) => (
          <BandCard key={band.id} band={band} onChange={(patch) => setEqBand(band.id, patch)} />
        ))}
      </div>

      <p className="mt-3 font-label-mono-sm text-label-mono-sm text-on-surface-variant/70">
        Drag 3D handles: FREQ / GAIN · Wheel on MID handles: Q
      </p>

      <button
        onClick={resetEq}
        className="w-full flex items-center justify-center gap-2 mt-3 py-1.5 rounded border border-primary/40 text-primary hover:bg-primary/5 active:scale-95 transition-all font-label-mono-sm text-label-mono-sm uppercase tracking-widest"
      >
        <span className="material-symbols-outlined text-base">restart_alt</span>
        Reset EQ
      </button>
    </div>
  );
}
