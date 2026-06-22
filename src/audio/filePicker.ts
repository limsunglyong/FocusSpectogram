// SonicCube v0.2.0 - 파일 선택 다이얼로그 헬퍼 (Phase 1)
import { ACCEPT_ATTR } from './decoder';

/** 숨김 input을 생성해 파일 선택 다이얼로그를 열고 선택된 파일을 반환 (취소 시 null) */
export function openAudioFilePicker(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT_ATTR;
    input.style.display = 'none';
    let settled = false;

    input.addEventListener('change', () => {
      settled = true;
      resolve(input.files?.[0] ?? null);
      input.remove();
    });
    // 다이얼로그를 닫아 취소한 경우(브라우저별 best-effort)
    window.addEventListener(
      'focus',
      () => {
        setTimeout(() => {
          if (!settled) {
            resolve(null);
            input.remove();
          }
        }, 300);
      },
      { once: true },
    );

    document.body.appendChild(input);
    input.click();
  });
}
