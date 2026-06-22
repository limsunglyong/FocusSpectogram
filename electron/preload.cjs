// SonicCube v0.8.0 - Electron 프리로드 (Phase 6)
// contextIsolation 환경에서 렌더러에 최소한의 안전한 API만 노출.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('soniccube', {
  isElectron: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
