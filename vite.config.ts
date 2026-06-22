import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// SonicCube v0.1.0 - 브라우저 우선 개발. base를 상대경로로 두어 추후 Electron 패키징 시 file:// 로딩 호환.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'], // Three.js를 별도 벤더 청크로 분리 (캐싱·초기 로드 최적화)
        },
      },
    },
  },
});
