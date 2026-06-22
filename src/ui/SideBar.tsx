// SonicCube v0.1.0 - 좌측 아이콘 사이드바 (DSP Tools)
interface Tool {
  icon: string;
  label: string;
  active?: boolean;
}

const TOOLS: Tool[] = [
  { icon: 'tune', label: 'Filters', active: true },
  { icon: 'graphic_eq', label: 'Spectral' },
  { icon: 'analytics', label: 'Data' },
  { icon: 'history', label: 'History' },
  { icon: 'folder', label: 'Library' },
];

export default function SideBar() {
  return (
    <aside className="bg-surface-container/10 backdrop-blur-xl border-r border-primary/10 flex flex-col items-center py-6 gap-4 w-20 h-full shrink-0">
      <div className="mb-6 text-center px-2">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center mb-1 mx-auto border border-primary/30">
          <span className="material-symbols-outlined text-primary">data_object</span>
        </div>
        <span className="block font-label-mono-sm text-label-mono-sm text-on-surface-variant uppercase tracking-widest scale-[0.7]">
          DSP Tools
        </span>
      </div>
      {TOOLS.map((tool) => (
        <button
          key={tool.label}
          className={`flex flex-col items-center gap-1 w-full py-2 transition-colors ${
            tool.active ? 'text-primary' : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined">{tool.icon}</span>
          <span className="font-label-mono-sm text-label-mono-sm">{tool.label}</span>
        </button>
      ))}
      <div className="mt-auto flex flex-col items-center gap-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
        <span className="material-symbols-outlined">settings</span>
        <span className="font-label-mono-sm text-label-mono-sm">Settings</span>
      </div>
    </aside>
  );
}
