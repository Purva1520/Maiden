/**
 * Seeded pseudo-random generator (mulberry32). Deterministic: the same seed
 * yields the same stream (§24/§25). All stochastic decisions in the engine draw
 * from an instance of this — never Math.random().
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  /** Next float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  /** Derive an independent stream (§26) without disturbing this one. */
  fork(salt: number): SeededRandom {
    return new SeededRandom((this.state ^ Math.imul(salt | 1, 0x9e3779b9)) >>> 0);
  }
}
