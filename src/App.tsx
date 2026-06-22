// SonicCube v0.1.0 - 앱 셸 (프로토타입 Fixed-Panel Grid 레이아웃)
import TopBar from './ui/TopBar';
import SideBar from './ui/SideBar';
import Viewport from './ui/Viewport';
import TransportBar from './ui/TransportBar';

export default function App() {
  return (
    <div className="h-screen w-screen flex flex-col bg-background text-on-surface overflow-hidden">
      <TopBar />
      <main className="flex-1 flex overflow-hidden">
        <SideBar />
        <Viewport />
      </main>
      <TransportBar />
    </div>
  );
}
