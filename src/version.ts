/**
 * SonicCube - 전역 앱 버전 상수
 *
 * 버전 규칙: v{Major}.{Minor}.{Patch}  (참고: 앱개발.md 지침)
 *  - Major : 사용자 선택 사항
 *  - Minor : 기능 추가 / 구조 변경
 *  - Patch : 버그 수정 / 기존 기능 개선
 *
 * 변경 이력
 *  - v0.1.0 : Phase 0 프로젝트 셋업 (초기 버전)
 *  - v0.2.0 : Phase 1 오디오 입력·디코딩 (파일 로드/메타데이터)
 *  - v0.2.1 : 버그수정 - Sample Rate가 원본이 아닌 컨텍스트 레이트(48kHz 고정)로 표시되던 문제
 *  - v0.3.0 : Phase 2 STFT/FFT 분석 엔진 (스펙트로그램 매트릭스, Web Worker)
 *  - v0.4.0 : Phase 3 3D 시각화 코어 (Three.js 서피스, 컬러맵, OrbitControls)
 *  - v0.5.0 : 3D 뷰 보완 - 뷰 리셋 기능 + 좌표축 라벨(time/frequency/intensity)·눈금 스케일
 *  - v0.5.1 : 축 라벨 개선(라운드 박스/normal/축소) + 주파수축 방향 반전(0Hz=원점)
 *  - v0.5.2 : 축 이름을 축 끝으로 이동·눈금과 동일 폰트, 주파수축 방향 재반전
 *  - v0.5.3 : TIME 축을 0Hz 원점 모서리(z=-DEPTH/2)로 이동 — 세 축이 원점에서 교차
 *  - v0.6.0 : Phase 4 UI 패널 연동 - Rotation X/Zoom/Perspective(ISO·ORTHO·3D) ↔ 카메라 양방향 동기화
 */
export const APP_NAME = 'SonicCube';
export const APP_VERSION = '0.6.0';
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
