import type {
  NeutralBucket,
  PlayerAttributes,
  SchemeFingerprint,
  SchemeFitLabel,
} from "@zone-blitz/shared";
import {
  type ArchetypeDemand,
  POSITION_ARCHETYPE_WEIGHTS,
  type SpectrumPole,
} from "./archetype-weights.ts";

/**
 * The minimum slice of a player required to compute fit. Accepts the
 * full `PlayerAttributes` block but only reads the keys referenced by
 * the position's archetype weights — unrelated attributes do not
 * influence the result.
 */
export interface PlayerForFit {
  neutralBucket: NeutralBucket;
  attributes: PlayerAttributes;
}

const LABEL_BUCKETS: { min: number; label: SchemeFitLabel }[] = [
  { min: 85, label: "ideal" },
  { min: 65, label: "fits" },
  { min: 40, label: "neutral" },
  { min: 20, label: "poor" },
  { min: 0, label: "miscast" },
];

/**
 * Map a 0–100 weighted-attribute score to the qualitative bucket the
 * UI is allowed to show (per ADR 0005 — no numeric fit is leaked).
 */
export function bucketScore(score: number): SchemeFitLabel {
  for (const bucket of LABEL_BUCKETS) {
    if (score >= bucket.min) return bucket.label;
  }
  return "miscast";
}

function demandStrength(
  axisValue: number | undefined,
  pole: SpectrumPole,
): number {
  if (axisValue === undefined) return 0;
  const lowStrength = Math.max(0, (50 - axisValue) / 50);
  const highStrength = Math.max(0, (axisValue - 50) / 50);
  return pole === "low" ? lowStrength : highStrength;
}

function axisValueFor(
  demand: ArchetypeDemand,
  fingerprint: SchemeFingerprint,
): number | undefined {
  const side = demand.side === "offense"
    ? fingerprint.offense
    : fingerprint.defense;
  if (!side) return undefined;
  return (side as unknown as Record<string, number>)[demand.axis];
}

export function computeSchemeScore(
  player: PlayerForFit,
  fingerprint: SchemeFingerprint,
): number {
  const demands = POSITION_ARCHETYPE_WEIGHTS[player.neutralBucket];
  if (!demands || demands.length === 0) return 50;

  let totalWeight = 0;
  let totalContribution = 0;

  for (const demand of demands) {
    const axisValue = axisValueFor(demand, fingerprint);
    const strength = demandStrength(axisValue, demand.pole);
    if (strength === 0) continue;
    for (const attr of demand.attributes) {
      const value = player.attributes[attr] ?? 0;
      totalContribution += strength * value;
      totalWeight += strength * 100;
    }
  }

  if (totalWeight === 0) return 50;
  return (totalContribution / totalWeight) * 100;
}

export function computeSchemeFit(
  player: PlayerForFit,
  fingerprint: SchemeFingerprint,
): SchemeFitLabel {
  return bucketScore(computeSchemeScore(player, fingerprint));
}
