// SonicCube v0.4.0 - 3D 스펙트로그램 캔버스 (Phase 3)
// v0.6.0: Viewport Settings 패널 ↔ 카메라 양방향 동기화 (Phase 4)
import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { SpectrogramScene } from '../viz/SpectrogramScene';

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

  // 씬 생성/해제 (마운트 1회)
  useEffect(() => {
    if (!containerRef.current) return;
    const scene = new SpectrogramScene(containerRef.current);
    sceneRef.current = scene;

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

  return <div ref={containerRef} className="absolute inset-0" />;
}
