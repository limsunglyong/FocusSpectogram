// SonicCube v0.1.0 - 하단 트랜스포트 바
// v0.2.0: 현재 파일명/길이(타임코드)를 메타데이터에서 바인딩 (Phase 1)
// v0.7.0: 재생/일시정지/스킵/반복 + 타임라인 스크러버(seek) + 실시간 타임코드 + 볼륨 (Phase 5)
import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { player } from '../audio/player';
import { APP_VERSION_LABEL } from '../version';

/** 초 → HH:MM:SS:CS (centiseconds) 타임코드 */
function formatTimecode(sec: number): string {
  const safe = Number.isFinite(sec) && sec > 0 ? sec : 0;
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const cs = Math.floor((safe * 100) % 100);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(cs)}`;
}

export default function TransportBar() {
  const meta = useAppStore((s) => s.meta);
  const ready = useAppStore((s) => s.loadStatus) === 'ready';
  const isPlaying = useAppStore((s) => s.isPlaying);
  const isLooping = useAppStore((s) => s.isLooping);
  const volume = useAppStore((s) => s.volume);
  const duration = useAppStore((s) => s.duration);
  const togglePlay = useAppStore((s) => s.togglePlay);
  const seek = useAppStore((s) => s.seek);
  const setVolume = useAppStore((s) => s.setVolume);
  const toggleLoop = useAppStore((s) => s.toggleLoop);

  const currentFileName = meta?.fileName ?? null;
  const [currentTime, setCurrentTime] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  // 재생 중에는 rAF로 위치를 갱신, 정지/일시정지 시 마지막 위치를 한 번 반영
  useEffect(() => {
    if (!isPlaying) {
      setCurrentTime(player.getCurrentTime());
      return;
    }
    let raf = 0;
    const tick = () => {
      setCurrentTime(player.getCurrentTime());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  // 새 파일 로드 등으로 duration이 바뀌면 위치 초기화
  useEffect(() => {
    setCurrentTime(player.getCurrentTime());
  }, [duration]);

  const handleSeek = (t: number) => {
    seek(t);
    setCurrentTime(Math.max(0, Math.min(t, duration)));
  };

  const seekFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el || duration <= 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    handleSeek(ratio * duration);
  };

  const onTrackPointerDown = (e: React.PointerEvent) => {
    if (!ready || duration <= 0) return;
    seekFromClientX(e.clientX);
    const move = (ev: PointerEvent) => seekFromClientX(ev.clientX);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
  const ctrlEnabled = ready && duration > 0;

  return (
    <footer className="bg-surface-container/10 backdrop-blur-xl border-t border-primary/10 h-20 shrink-0 flex flex-col">
      {/* 타임라인 스크러버 */}
      <div className="h-6 border-b border-outline-variant/40 flex items-center px-margin-desktop">
        <div
          ref={trackRef}
          onPointerDown={onTrackPointerDown}
          className={`group relative w-full h-2.5 rounded-full bg-primary/15 ${
            ctrlEnabled ? 'cursor-pointer' : 'cursor-default opacity-50'
          }`}
        >
          {/* 진행 채움 */}
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-primary/70"
            style={{ width: `${progress * 100}%` }}
          />
          {/* 플레이헤드 핸들 */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary shadow-[0_0_8px_rgba(251,191,36,0.6)]"
            style={{ left: `${progress * 100}%`, opacity: ctrlEnabled ? 1 : 0 }}
          />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-between px-margin-desktop">
        {/* 파일 정보 */}
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant uppercase">Current File</span>
            <span className="font-label-mono-lg text-label-mono-lg text-on-surface max-w-[16rem] truncate">
              {currentFileName ?? 'no file loaded'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant uppercase">Timecode</span>
            <span className="font-label-mono-lg text-label-mono-lg text-on-surface tabular-nums">
              {formatTimecode(currentTime)} <span className="text-on-surface-variant">/ {formatTimecode(duration)}</span>
            </span>
          </div>
        </div>

        {/* 트랜스포트 컨트롤 */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => handleSeek(0)}
            disabled={!ctrlEnabled}
            title="Restart"
            className="text-on-surface-variant hover:text-primary transition-colors disabled:opacity-30 disabled:hover:text-on-surface-variant"
          >
            <span className="material-symbols-outlined">skip_previous</span>
          </button>
          <button
            onClick={togglePlay}
            disabled={!ctrlEnabled}
            title={isPlaying ? 'Pause' : 'Play'}
            className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center hover:opacity-90 active:scale-95 transition-all disabled:opacity-30 disabled:active:scale-100"
          >
            <span className="material-symbols-outlined">{isPlaying ? 'pause' : 'play_arrow'}</span>
          </button>
          <button
            onClick={() => handleSeek(duration)}
            disabled={!ctrlEnabled}
            title="Skip to end"
            className="text-on-surface-variant hover:text-primary transition-colors disabled:opacity-30 disabled:hover:text-on-surface-variant"
          >
            <span className="material-symbols-outlined">skip_next</span>
          </button>
          <button
            onClick={toggleLoop}
            disabled={!ctrlEnabled}
            title="Loop"
            className={`transition-colors disabled:opacity-30 ${
              isLooping ? 'text-primary' : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined">repeat</span>
          </button>
        </div>

        {/* 볼륨 + 버전 표시 */}
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-on-surface-variant">
            {volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            title="Volume"
            className="w-20 accent-primary cursor-pointer"
          />
          <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant">{APP_VERSION_LABEL}</span>
        </div>
      </div>
    </footer>
  );
}
