// SonicCube v0.8.0 - Electron 메인 프로세스 (Phase 6)
// 개발: Vite dev 서버(http://localhost:5173) 로드 / 배포: 번들된 dist/index.html 로드.
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const DEV_SERVER_URL = process.env.ELECTRON_START_URL || 'http://localhost:5173';
const isDev = !app.isPackaged;

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#031716', // surface-container-lowest (씬 배경과 동일)
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // 창 준비 완료 후 표시(흰 화면 깜빡임 방지)
  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // 외부 링크(폰트 CDN 등 외 새 창 요청)는 기본 브라우저로
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // macOS 외에는 모든 창이 닫히면 종료
  if (process.platform !== 'darwin') app.quit();
});
