import type { NeutralBucket } from "../archetypes/neutral-bucket.ts";

export interface PositionalMarketEntry {
  multiplier: number;
  curveExponent: number;
}

export const POSITIONAL_MARKET_VALUES: Record<
  NeutralBucket,
  PositionalMarketEntry
> = {
  QB: { multiplier: 1.80, curveExponent: 1.40 },
  EDGE: { multiplier: 1.45, curveExponent: 1.30 },
  OT: { multiplier: 1.30, curveExponent: 1.25 },
  WR: { multiplier: 1.25, curveExponent: 1.20 },
  CB: { multiplier: 1.20, curveExponent: 1.15 },
  IDL: { multiplier: 1.10, curveExponent: 1.10 },
  S: { multiplier: 1.00, curveExponent: 1.05 },
  TE: { multiplier: 0.95, curveExponent: 1.03 },
  LB: { multiplier: 0.90, curveExponent: 1.02 },
  IOL: { multiplier: 0.85, curveExponent: 1.01 },
  RB: { multiplier: 0.65, curveExponent: 1.00 },
  K: { multiplier: 0.25, curveExponent: 1.00 },
  P: { multiplier: 0.25, curveExponent: 1.00 },
  LS: { multiplier: 0.20, curveExponent: 1.00 },
};

/**
 * Combines the positional base multiplier with a per-position convex curve
 * applied to a normalized quality score (0–99 → 0–1). Premium positions have
 * steeper curves so elite talent is disproportionately expensive.
 */
export function positionalSalaryMultiplier(
  position: NeutralBucket,
  quality: number,
): number {
  const { multiplier, curveExponent } = POSITIONAL_MARKET_VALUES[position];
  const normalized = Math.max(0, Math.min(quality, 99)) / 99;
  return multiplier * Math.pow(normalized, curveExponent);
}
