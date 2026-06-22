// SonicCube v0.3.0 - Radix-2 Cooley-Tukey FFT (Phase 2)
// 외부 의존성 없이 경량 구현. 고정 크기에 대해 bit-reversal/twiddle을 사전계산해 프레임 반복 시 재사용.

export class FFT {
  readonly size: number;
  private readonly rev: Uint32Array;
  private readonly cosTable: Float32Array; // cos(-2π k / n), k ∈ [0, n/2)
  private readonly sinTable: Float32Array; // sin(-2π k / n)

  constructor(size: number) {
    if (size < 2 || (size & (size - 1)) !== 0) {
      throw new Error(`FFT size는 2의 거듭제곱이어야 합니다: ${size}`);
    }
    this.size = size;

    // bit-reversal 인덱스 사전계산
    const bits = Math.log2(size);
    this.rev = new Uint32Array(size);
    for (let i = 0; i < size; i++) {
      let x = i;
      let r = 0;
      for (let b = 0; b < bits; b++) {
        r = (r << 1) | (x & 1);
        x >>= 1;
      }
      this.rev[i] = r;
    }

    // twiddle factor 사전계산
    const half = size >> 1;
    this.cosTable = new Float32Array(half);
    this.sinTable = new Float32Array(half);
    for (let k = 0; k < half; k++) {
      const ang = (-2 * Math.PI * k) / size;
      this.cosTable[k] = Math.cos(ang);
      this.sinTable[k] = Math.sin(ang);
    }
  }

  /** 복소수 in-place FFT. re/im 길이는 size와 같아야 한다. */
  transform(re: Float32Array, im: Float32Array): void {
    const n = this.size;
    const rev = this.rev;

    // bit-reversal 재배열
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (i < j) {
        const tr = re[i];
        re[i] = re[j];
        re[j] = tr;
        const ti = im[i];
        im[i] = im[j];
        im[j] = ti;
      }
    }

    const cosT = this.cosTable;
    const sinT = this.sinTable;
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1;
      const step = n / len; // twiddle 테이블 인덱스 보폭
      for (let i = 0; i < n; i += len) {
        for (let k = 0; k < half; k++) {
          const idx = k * step;
          const wr = cosT[idx];
          const wi = sinT[idx];
          const a = i + k;
          const b = a + half;
          const tr = wr * re[b] - wi * im[b];
          const ti = wr * im[b] + wi * re[b];
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
      }
    }
  }
}
