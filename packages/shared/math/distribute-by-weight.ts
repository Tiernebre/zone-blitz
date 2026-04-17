export interface WeightedKey<K> {
  key: K;
  weight: number;
}

/**
 * Largest-remainder apportionment: distribute `total` integer units across
 * `weights` so each key's share approximates `total * weight / sumW`, with
 * the rounding remainder going to the keys with the largest fractional part.
 *
 * Used by the coach and scout generators to split tier-level headcount
 * across sub-roles without drift from the per-team pool targets.
 */
export function distributeByWeight<K>(
  total: number,
  weights: ReadonlyArray<WeightedKey<K>>,
): Map<K, number> {
  const sumW = weights.reduce((a, w) => a + w.weight, 0);
  const rows = weights.map((w) => {
    const exact = (total * w.weight) / sumW;
    const floor = Math.floor(exact);
    return { key: w.key, floor, remainder: exact - floor };
  });
  const leftover = total - rows.reduce((a, r) => a + r.floor, 0);
  rows.sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < leftover; i++) rows[i].floor++;
  const out = new Map<K, number>();
  for (const r of rows) out.set(r.key, r.floor);
  return out;
}
