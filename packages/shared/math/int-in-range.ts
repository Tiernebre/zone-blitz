/**
 * Uniform integer in `[min, max]` inclusive, drawn from the provided
 * `random` source. Matches `SeededRng.int` but takes a raw `() => number`
 * for callers that thread a primitive RNG through their code.
 */
export function intInRange(
  random: () => number,
  min: number,
  max: number,
): number {
  return Math.floor(random() * (max - min + 1)) + min;
}
