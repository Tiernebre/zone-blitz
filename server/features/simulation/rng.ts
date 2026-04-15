export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SeededRng {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  gaussian(mean: number, stddev: number, min: number, max: number): number;
}

export function createRng(random: () => number): SeededRng {
  return {
    next: random,
    int(min, max) {
      return Math.floor(random() * (max - min + 1)) + min;
    },
    pick<T>(arr: readonly T[]): T {
      return arr[Math.floor(random() * arr.length)];
    },
    gaussian(mean, stddev, min, max) {
      const u1 = Math.max(random(), 1e-9);
      const u2 = random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const value = Math.round(mean + z * stddev);
      return Math.max(min, Math.min(max, value));
    },
  };
}

export function deriveGameSeed(
  leagueSeed: number,
  gameIdentifier: string,
): number {
  let hash = leagueSeed >>> 0;
  for (let i = 0; i < gameIdentifier.length; i++) {
    hash = (hash ^ gameIdentifier.charCodeAt(i)) >>> 0;
    hash = Math.imul(hash, 0x5BD1E995) >>> 0;
    hash = (hash ^ (hash >>> 15)) >>> 0;
  }
  return hash >>> 0;
}
