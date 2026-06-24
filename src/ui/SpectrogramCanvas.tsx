// SonicCube v0.4.0 - 3D 스펙트로그램 캔버스 (Phase 3)
// v0.6.0: Viewport Settings 패널 ↔ 카메라 양방향 동기화 (Phase 4)
// v0.7.0: 재생 위치 플레이헤드를 씬에 연동 (Phase 5)
import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { SpectrogramScene } from '../viz/SpectrogramScene';
import { player } from '../audio/player';

export default function SpectrogramCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SpectrogramScene | null>(null);
  // 카메라→스토어 반영 시 스토어→카메라 effect의 되먹임을 막기 위한 가드
  const lastFromScene = useRef<{ rotationX: number; zoom: number }>({ rotationX: NaN, zoom: NaN });

  const spectrogram = useAppStore((s) => s.spectrogram);
  const viewResetNonce = useAppStore((s) => s.viewResetNonce);
  const rotationX = useAppStore((s) => s.rotationX);
  const zoom = useAppStore((s) => s.zoom);
  const perspective = useAppStore((s) => s.perspective);
  const playedRegion = useAppStore((s) => s.playedRegion);
  const lufsLevel = useAppStore((s) => s.lufsLevel);
  const showLufsPlane = useAppStore((s) => s.showLufsPlane);

  // 씬 생성/해제 (마운트 1회)
  useEffect(() => {
    if (!containerRef.current) return;
    const scene = new SpectrogramScene(containerRef.current);
    sceneRef.current = scene;

    // 재생 위치를 매 프레임 씬이 직접 조회(React 리렌더 없이 플레이헤드 이동)
    scene.playheadTimeProvider = () => player.getCurrentTime();

    // 드래그 등으로 카메라가 바뀌면 슬라이더(store)에 반영
    scene.onCameraChange = (st) => {
      const rx = Math.round(st.rotationX);
      const z = Math.round(st.zoom * 10) / 10;
      lastFromScene.current = { rotationX: rx, zoom: z };
      const { setRotationX, setZoom } = useAppStore.getState();
      setRotationX(rx);
      setZoom(z);
    };

    // 초기 store 값 적용
    const s = useAppStore.getState();
    scene.setPerspective(s.perspective);
    scene.setRotationX(s.rotationX);
    scene.setZoom(s.zoom);

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // 스펙트로그램 변경 시 메쉬 갱신
  useEffect(() => {
    sceneRef.current?.setSpectrogram(spectrogram);
  }, [spectrogram]);

  // 뷰 리셋 요청 시 카메라 복원 (초기값 0은 무시)
  useEffect(() => {
    if (viewResetNonce > 0) sceneRef.current?.resetView();
  }, [viewResetNonce]);

  // store(슬라이더) → 카메라 (카메라발 변경이면 skip)
  useEffect(() => {
    if (rotationX === lastFromScene.current.rotationX) return;
    sceneRef.current?.setRotationX(rotationX);
  }, [rotationX]);

  useEffect(() => {
    if (zoom === lastFromScene.current.zoom) return;
    sceneRef.current?.setZoom(zoom);
  }, [zoom]);

  useEffect(() => {
    sceneRef.current?.setPerspective(perspective);
  }, [perspective]);

  // v0.7.1: 지나온 구간 표시 방식 (show=0 / fade=1 / hide=2)
  useEffect(() => {
    const mode = playedRegion === 'hide' ? 2 : playedRegion === 'fade' ? 1 : 0;
    sceneRef.current?.setPlayedMode(mode);
  }, [playedRegion]);

  useEffect(() => {
    sceneRef.current?.setLufsReference(lufsLevel, showLufsPlane);
  }, [lufsLevel, showLufsPlane]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
