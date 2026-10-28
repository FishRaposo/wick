// Small seedable PRNG. Every random choice in the rules goes through this, so a seed replays a run.
// The current state is a plain number so a run can be saved and resumed exactly.

export function mulberry32(seed: number): () => number {
  const rng = new Rng(seed);
  return () => rng.next();
}

export class Rng {
  seed: number;
  state: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  next(): number {
    let a = (this.state + 0x6d2b79f5) >>> 0;
    this.state = a;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  float(lo = 0, hi = 1): number {
    return lo + (hi - lo) * this.next();
  }

  int(lo: number, hi: number): number {
    return Math.floor(this.float(lo, hi + 1));
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  chance(p: number): boolean {
    return this.next() < p;
  }
}
