// SonicCube v0.7.0 - 오디오 재생 엔진 (Phase 5)
// AudioBufferSourceNode + GainNode 기반 재생/일시정지/정지/seek/볼륨.
// Web Audio는 재생 위치를 직접 제공하지 않으므로 AudioContext.currentTime으로 추적한다.
// v0.9.0: source → [EQ BiquadFilter 체인] → gain(master) → destination (실시간 EQ)
import { getAudioContext } from './decoder';
import { DEFAULT_EQ_BANDS, computeEqMagnitudeDb, type EqBand } from './eq';

export class AudioPlayer {
  private ctx: AudioContext;
  private gain: GainNode;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;

  // v0.9.0: EQ 체인 (DEFAULT_EQ_BANDS 순서대로 직렬 연결, 항상 source→eqInput→…→gain)
  private eqNodes: BiquadFilterNode[] = [];
  private eqInput: AudioNode;
  private eqBands: EqBand[] = DEFAULT_EQ_BANDS.map((b) => ({ ...b }));
  private _eqEnabled = false;

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

    // v0.9.0: EQ BiquadFilter 체인 구성 (초기 게인 0 = 바이패스, eqEnabled=false)
    this.eqNodes = this.eqBands.map((b) => {
      const n = this.ctx.createBiquadFilter();
      n.type = b.type;
      n.frequency.value = b.frequency;
      n.Q.value = b.q;
      n.gain.value = 0;
      return n;
    });
    for (let i = 0; i < this.eqNodes.length - 1; i++) {
      this.eqNodes[i].connect(this.eqNodes[i + 1]);
    }
    this.eqInput = this.eqNodes[0];
    this.eqNodes[this.eqNodes.length - 1].connect(this.gain);
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
    src.connect(this.eqInput); // v0.9.0: EQ 체인 경유 (바이패스 시 밴드 게인 0으로 unity)
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

  // ---- v0.9.0: EQ 제어 -----------------------------------------------------

  get eqEnabled(): boolean {
    return this._eqEnabled;
  }

  /** EQ 전체 on/off. off면 모든 밴드 게인을 0(unity)으로 부드럽게 램프 */
  setEqEnabled(enabled: boolean) {
    this._eqEnabled = enabled;
    this.applyEqGains();
  }

  /** 밴드 파라미터 일괄 갱신 (노드 재생성 없이 AudioParam만 갱신 → 클릭음 없음) */
  setEqBands(bands: EqBand[]) {
    this.eqBands = bands.map((b) => ({ ...b }));
    const t = this.ctx.currentTime;
    const nyq = this.ctx.sampleRate / 2;
    this.eqNodes.forEach((n, i) => {
      const b = this.eqBands[i];
      if (!b) return;
      if (n.type !== b.type) n.type = b.type;
      n.frequency.setTargetAtTime(Math.min(b.frequency, nyq * 0.99), t, 0.01);
      n.Q.setTargetAtTime(b.q, t, 0.01);
      n.gain.setTargetAtTime(this._eqEnabled ? b.gain : 0, t, 0.01);
    });
  }

  /** 현재 enabled 상태에 맞춰 밴드 게인 적용 */
  private applyEqGains() {
    const t = this.ctx.currentTime;
    this.eqNodes.forEach((n, i) => {
      const b = this.eqBands[i];
      if (!b) return;
      n.gain.setTargetAtTime(this._eqEnabled ? b.gain : 0, t, 0.01);
    });
  }

  /** 주어진 주파수 배열에 대한 EQ 합성 응답(dB). 오버레이 곡선용 (오디오와 동일 계수식) */
  getEqResponseDb(freqHz: Float32Array): Float32Array {
    return computeEqMagnitudeDb(this.eqBands, freqHz, this.ctx.sampleRate, this._eqEnabled);
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
