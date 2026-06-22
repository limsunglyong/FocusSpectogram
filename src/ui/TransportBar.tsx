// SonicCube v0.1.0 - 하단 트랜스포트 바 (재생 로직은 Phase 5)
// v0.2.0: 현재 파일명/길이(타임코드)를 메타데이터에서 바인딩 (Phase 1)
import { useAppStore } from '../store/appStore';
import { APP_VERSION_LABEL } from '../version';

/** 초 → HH:MM:SS:CS (centiseconds) 타임코드 */
function formatTimecode(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec * 100) % 100);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(cs)}`;
}

export default function TransportBar() {
  const meta = useAppStore((s) => s.meta);
  const ready = useAppStore((s) => s.loadStatus) === 'ready';
  const currentFileName = meta?.fileName ?? null;
  return (
    <footer className="bg-surface-container/10 backdrop-blur-xl border-t border-primary/10 h-20 shrink-0 flex flex-col">
      {/* 타임라인 (Phase 5에서 스크러버로 구현) */}
      <div className="h-6 border-b border-outline-variant/40 flex items-end px-margin-desktop">
        <div className="w-full h-3 flex items-end gap-[2px] opacity-50">
          {Array.from({ length: 80 }).map((_, i) => (
            <div key={i} className={`flex-1 bg-primary/40 ${i % 8 === 0 ? 'h-3' : 'h-1.5'}`} />
          ))}
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
            <span className="font-label-mono-lg text-label-mono-lg text-on-surface">
              {ready && meta ? formatTimecode(meta.duration) : '00:00:00:00'}
            </span>
          </div>
        </div>

        {/* 트랜스포트 컨트롤 */}
        <div className="flex items-center gap-4">
          <button className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">skip_previous</span>
          </button>
          <button className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center hover:opacity-90 active:scale-95 transition-all">
            <span className="material-symbols-outlined">play_arrow</span>
          </button>
          <button className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">skip_next</span>
          </button>
          <button className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">repeat</span>
          </button>
        </div>

        {/* 버전 표시 */}
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-on-surface-variant">volume_up</span>
          <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant">{APP_VERSION_LABEL}</span>
        </div>
      </div>
    </footer>
  );
}
