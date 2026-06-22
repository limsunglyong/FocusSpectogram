// SonicCube v0.7.0 - 오디오 재생 엔진 (Phase 5)
// AudioBufferSourceNode + GainNode 기반 재생/일시정지/정지/seek/볼륨.
// Web Audio는 재생 위치를 직접 제공하지 않으므로 AudioContext.currentTime으로 추적한다.
import { getAudioContext } from './decoder';

export class AudioPlayer {
  private ctx: AudioContext;
  private gain: GainNode;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;

  private startedAtCtx = 0; // 재생을 (재)시작한 순간의 ctx.currentTime
  private startOffset = 0; // 그 순간의 버퍼 내 위치(초)
  private _playing = false;
  private _loop = false;

  /** 자연 종료(끝까지 재생) 시 호출 */
  onEnded: (() => void) | null = null;
  /** 재생/정지 상태 변화 시 호출 */
  onStateChange: ((playing: boolean) => void) | null = null;

  constructor() {
    this.ctx = getAudioContext();
    this.gain = this.ctx.createGain();
    this.gain.connect(this.ctx.destination);
  }

  /** 버퍼 교체 (재생 중이면 정지하고 위치 초기화) */
  load(buffer: AudioBuffer | null) {
    this.stopSource();
    this.buffer = buffer;
    this.startOffset = 0;
    if (this._playing) {
      this._playing = false;
      this.onStateChange?.(false);
    }
  }

  get duration(): number {
    return this.buffer?.duration ?? 0;
  }

  get playing(): boolean {
    return this._playing;
  }

  get loop(): boolean {
    return this._loop;
  }

  setVolume(v: number) {
    this.gain.gain.value = Math.max(0, Math.min(1, v));
  }

  setLoop(l: boolean) {
    this._loop = l;
    if (this.source) this.source.loop = l;
  }

  /** 현재 재생 위치(초). 정지 상태면 마지막 위치(seek 위치)를 반환 */
  getCurrentTime(): number {
    if (!this.buffer) return 0;
    if (this._playing) {
      let t = this.startOffset + (this.ctx.currentTime - this.startedAtCtx);
      const dur = this.duration;
      if (this._loop && dur > 0) t %= dur;
      return Math.min(t, dur);
    }
    return this.startOffset;
  }

  play() {
    if (!this.buffer || this._playing) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();

    let offset = this.startOffset;
    if (offset >= this.duration) offset = 0; // 끝에서 재생 시 처음부터

    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = this._loop;
    src.connect(this.gain);
    // 자연 종료 핸들러. 수동 정지(stopSource)는 onended를 먼저 null로 만들어 무시된다.
    src.onended = () => {
      this.source = null;
      this._playing = false;
      this.startOffset = this.duration; // 끝 위치 유지
      this.onStateChange?.(false);
      this.onEnded?.();
    };

    this.source = src;
    this.startedAtCtx = this.ctx.currentTime;
    this.startOffset = offset;
    src.start(0, offset);
    this._playing = true;
    this.onStateChange?.(true);
  }

  pause() {
    if (!this._playing) return;
    const t = this.getCurrentTime();
    this.stopSource();
    this.startOffset = t;
    this._playing = false;
    this.onStateChange?.(false);
  }

  stop() {
    this.stopSource();
    this.startOffset = 0;
    if (this._playing) {
      this._playing = false;
      this.onStateChange?.(false);
    }
  }

  /** 위치 이동(초). 재생 중이면 새 위치에서 즉시 이어서 재생 */
  seek(t: number) {
    const clamped = Math.max(0, Math.min(t, this.duration));
    const wasPlaying = this._playing;
    if (wasPlaying) {
      this.stopSource();
      this._playing = false;
    }
    this.startOffset = clamped;
    if (wasPlaying) this.play();
  }

  /** 현재 소스를 정지·해제. onended를 먼저 null로 만들어 자연 종료 콜백 차단 */
  private stopSource() {
    if (this.source) {
      this.source.onended = null;
      try {
        this.source.stop();
      } catch {
        /* 이미 정지된 소스 */
      }
      this.source.disconnect();
      this.source = null;
    }
  }
}

/** 앱 전역 단일 플레이어 */
export const player = new AudioPlayer();
