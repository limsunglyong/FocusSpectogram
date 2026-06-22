// SonicCube v0.1.0 - 앱 진입점
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { APP_NAME, APP_VERSION_LABEL } from './version';

// 콘솔에 버전 표기
console.info(`%c${APP_NAME} ${APP_VERSION_LABEL}`, 'color:#fbbf24;font-weight:bold');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
