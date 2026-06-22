// SonicCube v0.1.0 - 상단 툴바
// v0.2.0: Upload File 버튼에 파일 선택·디코딩 연결 (Phase 1)
import { APP_NAME } from '../version';
import { useAppStore } from '../store/appStore';
import { openAudioFilePicker } from '../audio/filePicker';

const NAV = ['Dashboard', 'Analysis', 'Presets', 'Archive'];

export default function TopBar() {
  const loadFile = useAppStore((s) => s.loadFile);
  const loadStatus = useAppStore((s) => s.loadStatus);

  const handleUpload = async () => {
    const file = await openAudioFilePicker();
    if (file) await loadFile(file);
  };

  return (
    <header className="bg-surface-container/10 backdrop-blur-xl border-b border-primary/10 flex justify-between items-center px-margin-desktop w-full h-16 z-50 shrink-0">
      <div className="flex items-center gap-8">
        <h1 className="font-headline-lg text-headline-lg font-bold text-primary tracking-tighter">{APP_NAME}</h1>
        <nav className="hidden md:flex items-center gap-6">
          {NAV.map((item, i) => (
            <a
              key={item}
              href="#"
              className={
                i === 0
                  ? 'text-primary border-b-2 border-primary pb-1 font-body-md text-body-md'
                  : 'text-on-surface-variant font-body-md text-body-md hover:text-primary transition-colors'
              }
            >
              {item}
            </a>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <button className="bg-primary text-on-primary px-4 py-1.5 rounded-lg font-bold hover:opacity-90 active:scale-95 transition-all text-body-md">
          Live Record
        </button>
        <button
          onClick={handleUpload}
          disabled={loadStatus === 'loading'}
          className="border border-primary/40 text-primary px-4 py-1.5 rounded-lg font-medium hover:bg-primary/5 active:scale-95 transition-all text-body-md disabled:opacity-50 disabled:cursor-wait"
        >
          {loadStatus === 'loading' ? 'Loading…' : 'Upload File'}
        </button>
        <div className="flex items-center gap-2 ml-4">
          <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors">settings</span>
          <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors">help</span>
        </div>
      </div>
    </header>
  );
}
