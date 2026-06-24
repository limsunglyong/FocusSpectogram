// SonicCube v0.10.0 - Noise Print 패널 (수동/자동 구간 캡처 + 후보 영역 도식화)
import {
  NOISE_SMOOTHING_MAX,
  NOISE_SMOOTHING_MIN,
  NOISE_THRESHOLD_MAX,
  NOISE_THRESHOLD_MIN,
} from '../../audio/noisePrint';
import { useAppStore } from '../../store/appStore';

function fmtTime(sec: number): string {
  return `${sec.toFixed(sec < 10 ? 2 : 1)}s`;
}

function fmtDb(db: number): string {
  return Number.isFinite(db) ? `${db.toFixed(1)} dB` : '— dB';
}

export default function NoisePrintPanel() {
  const duration = useAppStore((s) => s.duration);
  const ready = useAppStore((s) => s.analysisStatus === 'done' && s.spectrogram !== null);
  const noisePrint = useAppStore((s) => s.noisePrint);
  const showNoisePrint = useAppStore((s) => s.showNoisePrint);
  const noiseThresholdDb = useAppStore((s) => s.noiseThresholdDb);
  const noiseSmoothingBins = useAppStore((s) => s.noiseSmoothingBins);
  const noiseRangeStart = useAppStore((s) => s.noiseRangeStart);
  const noiseRangeEnd = useAppStore((s) => s.noiseRangeEnd);
  const noiseRangeCandidate = useAppStore((s) => s.noiseRangeCandidate);
  const noisePrintError = useAppStore((s) => s.noisePrintError);
  const captureNoisePrint = useAppStore((s) => s.captureNoisePrint);
  const findQuietNoiseRange = useAppStore((s) => s.findQuietNoiseRange);
  const clearNoisePrint = useAppStore((s) => s.clearNoisePrint);
  const setNoiseRange = useAppStore((s) => s.setNoiseRange);
  const setShowNoisePrint = useAppStore((s) => s.setShowNoisePrint);
  const setNoiseThresholdDb = useAppStore((s) => s.setNoiseThresholdDb);
  const setNoiseSmoothingBins = useAppStore((s) => s.setNoiseSmoothingBins);

  const safeStart = Math.max(0, Math.min(noiseRangeStart, duration));
  const safeEnd = Math.max(0, Math.min(noiseRangeEnd, duration));
  const canCapture = ready && safeEnd > safeStart;

  return (
    <div className="glass-panel rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-label-mono-sm text-label-mono-sm text-primary uppercase tracking-widest">
          Noise Print
        </p>
        <label className="flex items-center gap-1 font-label-mono-sm text-label-mono-sm text-on-surface-variant uppercase">
          <input
            type="checkbox"
            checked={showNoisePrint}
            disabled={!noisePrint}
            onChange={(e) => setShowNoisePrint(e.target.checked)}
            className="accent-primary"
          />
          Show
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="font-label-mono-sm text-label-mono-sm text-on-surface-variant uppercase">
          Start
          <input
            type="number"
            min={0}
            max={duration}
            step={0.1}
            value={safeStart}
            disabled={!ready}
            onChange={(e) => setNoiseRange(Number(e.target.value), safeEnd)}
            className="mt-1 w-full rounded border border-primary/30 bg-background/60 px-2 py-1 text-on-surface outline-none focus:border-primary disabled:opacity-50"
          />
        </label>
        <label className="font-label-mono-sm text-label-mono-sm text-on-surface-variant uppercase">
          End
          <input
            type="number"
            min={0}
            max={duration}
            step={0.1}
            value={safeEnd}
            disabled={!ready}
            onChange={(e) => setNoiseRange(safeStart, Number(e.target.value))}
            className="mt-1 w-full rounded border border-primary/30 bg-background/60 px-2 py-1 text-on-surface outline-none focus:border-primary disabled:opacity-50"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <label className="font-label-mono-sm text-label-mono-sm text-on-surface-variant uppercase">
          Match Threshold
          <div className="flex items-center gap-2 mt-1">
            <input
              type="range"
              min={NOISE_THRESHOLD_MIN}
              max={NOISE_THRESHOLD_MAX}
              step={1}
              value={noiseThresholdDb}
              onChange={(e) => setNoiseThresholdDb(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="w-12 text-right text-primary">{noiseThresholdDb}dB</span>
          </div>
        </label>
        <label className="font-label-mono-sm text-label-mono-sm text-on-surface-variant uppercase">
          Smoothing
          <div className="flex items-center gap-2 mt-1">
            <input
              type="range"
              min={NOISE_SMOOTHING_MIN}
              max={NOISE_SMOOTHING_MAX}
              step={1}
              value={noiseSmoothingBins}
              onChange={(e) => setNoiseSmoothingBins(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="w-12 text-right text-primary">{noiseSmoothingBins}bin</span>
          </div>
        </label>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={findQuietNoiseRange}
          disabled={!ready}
          className="rounded border border-secondary/50 px-2 py-1.5 font-label-mono-sm text-label-mono-sm text-secondary uppercase tracking-widest hover:bg-secondary/10 disabled:opacity-40"
        >
          Find
        </button>
        <button
          onClick={captureNoisePrint}
          disabled={!canCapture}
          className="flex-1 rounded bg-primary px-2 py-1.5 font-label-mono-sm text-label-mono-sm text-on-primary uppercase tracking-widest hover:opacity-90 disabled:opacity-40"
        >
          Capture
        </button>
        <button
          onClick={clearNoisePrint}
          disabled={!noisePrint}
          className="rounded border border-primary/40 px-2 py-1.5 font-label-mono-sm text-label-mono-sm text-primary uppercase tracking-widest hover:bg-primary/5 disabled:opacity-40"
        >
          Clear
        </button>
      </div>

      {noisePrint ? (
        <div className="mt-3 border-t border-outline-variant pt-3 font-label-mono-sm text-label-mono-sm text-on-surface-variant">
          <p>
            Range <span className="text-on-surface">{fmtTime(noisePrint.startTime)}–{fmtTime(noisePrint.endTime)}</span>
          </p>
          <p>
            Avg <span className="text-secondary">{fmtDb(noisePrint.avgDb)}</span> · Peak{' '}
            <span className="text-primary">{fmtDb(noisePrint.peakDb)}</span>
          </p>
          <p className="mt-1 text-on-surface-variant/70">Violet areas indicate bins close to the captured noise print.</p>
        </div>
      ) : (
        <p className="mt-3 font-label-mono-sm text-label-mono-sm text-on-surface-variant/70">
          Select a noise-only range, then capture its spectral fingerprint.
        </p>
      )}

      {noiseRangeCandidate && (
        <div className="mt-2 rounded border border-secondary/20 bg-secondary/5 p-2 font-label-mono-sm text-label-mono-sm text-on-surface-variant">
          <p className="text-secondary uppercase">Find Candidate</p>
          <p>
            Avg <span className="text-on-surface">{fmtDb(noiseRangeCandidate.avgDb)}</span> · Peak{' '}
            <span className={noiseRangeCandidate.peakDb > -35 ? 'text-error' : 'text-primary'}>
              {fmtDb(noiseRangeCandidate.peakDb)}
            </span>
          </p>
          <p>
            Stability <span className="text-on-surface">{noiseRangeCandidate.stabilityDb.toFixed(1)} dB</span>
          </p>
        </div>
      )}

      {noisePrintError && (
        <p className="mt-2 font-label-mono-sm text-label-mono-sm text-error">{noisePrintError}</p>
      )}
    </div>
  );
}
