import type { NeutralBucket } from "@zone-blitz/shared";

/**
 * Position × tier priors for contract structure (length, guarantee
 * share, signing-bonus share, per-year cap-hit shape), sourced from
 * `data/bands/contract-structure.json`. Real NFL contracts are shaped
 * by position × market-tier first; team cap archetype only modulates
 * on top. Callers compose these priors with an archetype modifier.
 */

const BAND_URL = new URL(
  "../../../data/bands/contract-structure.json",
  import.meta.url,
);

interface RawLengthEntry {
  mean_years: number;
  p10_years: number;
  p90_years: number;
}
interface RawGuaranteeEntry {
  mean_share: number;
  p10_share: number;
  p90_share: number;
}
interface RawBonusEntry {
  mean_signing_bonus_share: number;
  p10_signing_bonus_share: number;
  p90_signing_bonus_share: number;
}
interface RawShapeEntry {
  mean_pct_year_1: number | string;
  mean_pct_year_2: number | string;
  mean_pct_year_3: number | string;
  mean_pct_year_4: number | string;
  mean_pct_year_5: number | string;
}
interface RawBandData {
  bands: {
    length_by_position_tier: Record<string, Record<string, RawLengthEntry>>;
    guarantee_share_by_position_tier: Record<
      string,
      Record<string, RawGuaranteeEntry>
    >;
    signing_bonus_share_by_position_tier: Record<
      string,
      Record<string, RawBonusEntry>
    >;
    cap_hit_shape_by_position_tier: Record<
      string,
      Record<string, RawShapeEntry>
    >;
  };
}

const BAND_DATA: RawBandData = JSON.parse(
  Deno.readTextFileSync(BAND_URL),
) as RawBandData;

export type ContractDataPosition =
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "OT"
  | "IOL"
  | "EDGE"
  | "IDL"
  | "LB"
  | "CB"
  | "S"
  | "ST";

export type ContractDataTier = "top_10" | "top_25" | "top_50" | "rest";

export type QualityTier = "star" | "starter" | "depth";

export interface ContractStructurePrior {
  lengthMean: number;
  lengthP10: number;
  lengthP90: number;
  guaranteeShareMean: number;
  guaranteeShareP10: number;
  guaranteeShareP90: number;
  bonusShareMean: number;
  bonusShareP10: number;
  bonusShareP90: number;
  /** Normalised 5-year cap-hit shape; sums to 1. */
  capHitShape: readonly [number, number, number, number, number];
}

export function bucketToContractPosition(
  bucket: NeutralBucket,
): ContractDataPosition {
  // Kickers / punters / long snappers roll into the "ST" group the OTC
  // feed uses — it's the only cohort that represents these roles at all.
  if (bucket === "K" || bucket === "P" || bucket === "LS") return "ST";
  return bucket;
}

export function qualityTierToContractTier(
  tier: QualityTier,
): ContractDataTier {
  if (tier === "star") return "top_10";
  if (tier === "starter") return "top_50";
  return "rest";
}

function readNumber(value: number | string): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function getContractStructurePrior(
  position: ContractDataPosition,
  tier: ContractDataTier,
): ContractStructurePrior {
  const len = BAND_DATA.bands.length_by_position_tier[position][tier];
  const guar = BAND_DATA.bands.guarantee_share_by_position_tier[position][tier];
  const bonus =
    BAND_DATA.bands.signing_bonus_share_by_position_tier[position][tier];
  const shape = BAND_DATA.bands.cap_hit_shape_by_position_tier[position][tier];

  const raw = [
    readNumber(shape.mean_pct_year_1),
    readNumber(shape.mean_pct_year_2),
    readNumber(shape.mean_pct_year_3),
    readNumber(shape.mean_pct_year_4),
    readNumber(shape.mean_pct_year_5),
  ];
  const sum = raw.reduce((s, v) => s + v, 0);
  const capHitShape =
    (sum > 0
      ? raw.map((v) => v / sum)
      : [0.2, 0.2, 0.2, 0.2, 0.2]) as unknown as readonly [
        number,
        number,
        number,
        number,
        number,
      ];

  return {
    lengthMean: len.mean_years,
    lengthP10: len.p10_years,
    lengthP90: len.p90_years,
    guaranteeShareMean: guar.mean_share,
    guaranteeShareP10: guar.p10_share,
    guaranteeShareP90: guar.p90_share,
    bonusShareMean: bonus.mean_signing_bonus_share,
    bonusShareP10: bonus.p10_signing_bonus_share,
    bonusShareP90: bonus.p90_signing_bonus_share,
    capHitShape,
  };
}
