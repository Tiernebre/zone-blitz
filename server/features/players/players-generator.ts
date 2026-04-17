import {
  type CapArchetype,
  clamp,
  createRng,
  NEUTRAL_BUCKETS,
  type NeutralBucket,
  neutralBucket,
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributeKey,
  type PlayerAttributes,
  positionalSalaryMultiplier,
  type SeededRng,
} from "@zone-blitz/shared";
import {
  createNameGenerator,
  type NameGenerator,
} from "../../shared/name-generator.ts";
import { DEFAULT_COLLEGES } from "../colleges/default-colleges.ts";
import { DEFAULT_CITIES } from "../cities/default-cities.ts";
import { sampleBucketAge } from "./age-curves.ts";
import type { ContractGuaranteeType } from "@zone-blitz/shared";
import type {
  ContractGeneratorInput,
  GeneratedBonusProration,
  GeneratedContract,
  GeneratedContractBundle,
  GeneratedContractYear,
  GeneratedPlayers,
  PlayersGenerator,
  PlayersGeneratorInput,
} from "./players.generator.interface.ts";

// Re-export the shared NameGenerator type for consumer tests that want to
// mock a name source without reaching into server/shared directly.
export type { NameGenerator };

export interface BucketProfile {
  /** Median height (inches); actual is drawn within ±heightSpread. */
  heightInches: number;
  /** Median weight (pounds); actual is drawn within ±weightSpread. */
  weightPounds: number;
  heightSpread: number;
  weightSpread: number;
  /** Attributes biased upward (archetype signature + close complements). */
  signature: readonly PlayerAttributeKey[];
  /** Attributes biased downward (archetype doesn't rely on these). */
  deEmphasized: readonly PlayerAttributeKey[];
}

export const BUCKET_PROFILES: Record<NeutralBucket, BucketProfile> = {
  QB: {
    heightInches: 75,
    weightPounds: 225,
    heightSpread: 2,
    weightSpread: 15,
    signature: [
      "armStrength",
      "accuracyShort",
      "accuracyMedium",
      "accuracyDeep",
      "release",
      "decisionMaking",
      "touch",
      "composure",
    ],
    deEmphasized: [
      "passBlocking",
      "runBlocking",
      "blockShedding",
      "tackling",
      "manCoverage",
      "zoneCoverage",
      "kickingPower",
      "puntingPower",
      "snapAccuracy",
    ],
  },
  RB: {
    heightInches: 71,
    weightPounds: 215,
    heightSpread: 2,
    weightSpread: 15,
    signature: [
      "ballCarrying",
      "elusiveness",
      "acceleration",
      "speed",
      "agility",
      "runAfterCatch",
    ],
    deEmphasized: [
      "armStrength",
      "accuracyDeep",
      "passBlocking",
      "manCoverage",
      "zoneCoverage",
      "kickingPower",
      "puntingPower",
      "snapAccuracy",
    ],
  },
  WR: {
    heightInches: 73,
    weightPounds: 200,
    heightSpread: 3,
    weightSpread: 15,
    signature: [
      "routeRunning",
      "catching",
      "speed",
      "acceleration",
      "agility",
      "runAfterCatch",
      "contestedCatching",
    ],
    deEmphasized: [
      "armStrength",
      "passBlocking",
      "runBlocking",
      "manCoverage",
      "zoneCoverage",
      "kickingPower",
      "puntingPower",
      "snapAccuracy",
    ],
  },
  TE: {
    heightInches: 77,
    weightPounds: 252,
    heightSpread: 2,
    weightSpread: 12,
    signature: [
      "catching",
      "runBlocking",
      "passBlocking",
      "contestedCatching",
      "routeRunning",
      "strength",
    ],
    deEmphasized: [
      "armStrength",
      "speed",
      "manCoverage",
      "zoneCoverage",
      "kickingPower",
      "puntingPower",
      "snapAccuracy",
    ],
  },
  OT: {
    heightInches: 78,
    weightPounds: 315,
    heightSpread: 1,
    weightSpread: 15,
    signature: [
      "passBlocking",
      "runBlocking",
      "agility",
      "strength",
      "footballIq",
    ],
    deEmphasized: [
      "speed",
      "catching",
      "routeRunning",
      "armStrength",
      "manCoverage",
      "zoneCoverage",
      "kickingPower",
      "puntingPower",
      "snapAccuracy",
    ],
  },
  IOL: {
    heightInches: 74,
    weightPounds: 312,
    heightSpread: 1,
    weightSpread: 12,
    signature: [
      "runBlocking",
      "passBlocking",
      "strength",
      "footballIq",
    ],
    deEmphasized: [
      "speed",
      "catching",
      "routeRunning",
      "armStrength",
      "manCoverage",
      "zoneCoverage",
      "kickingPower",
      "puntingPower",
      "snapAccuracy",
    ],
  },
  EDGE: {
    heightInches: 76,
    weightPounds: 262,
    heightSpread: 2,
    weightSpread: 15,
    signature: [
      "passRushing",
      "acceleration",
      "blockShedding",
      "speed",
      "strength",
      "tackling",
    ],
    deEmphasized: [
      "armStrength",
      "catching",
      "routeRunning",
      "passBlocking",
      "runBlocking",
      "manCoverage",
      "kickingPower",
      "puntingPower",
      "snapAccuracy",
    ],
  },
  IDL: {
    heightInches: 74,
    weightPounds: 305,
    heightSpread: 2,
    weightSpread: 15,
    signature: [
      "strength",
      "blockShedding",
      "runDefense",
      "passRushing",
      "tackling",
    ],
    deEmphasized: [
      "armStrength",
      "speed",
      "catching",
      "routeRunning",
      "passBlocking",
      "runBlocking",
      "manCoverage",
      "zoneCoverage",
      "kickingPower",
      "puntingPower",
      "snapAccuracy",
    ],
  },
  LB: {
    heightInches: 73,
    weightPounds: 235,
    heightSpread: 2,
    weightSpread: 15,
    signature: [
      "tackling",
      "runDefense",
      "zoneCoverage",
      "footballIq",
      "speed",
      "anticipation",
      "blockShedding",
    ],
    deEmphasized: [
      "armStrength",
      "catching",
      "routeRunning",
      "passBlocking",
      "runBlocking",
      "kickingPower",
      "puntingPower",
      "snapAccuracy",
    ],
  },
  CB: {
    heightInches: 72,
    weightPounds: 195,
    heightSpread: 2,
    weightSpread: 10,
    signature: [
      "manCoverage",
      "zoneCoverage",
      "speed",
      "agility",
      "anticipation",
      "acceleration",
    ],
    deEmphasized: [
      "armStrength",
      "passBlocking",
      "runBlocking",
      "strength",
      "blockShedding",
      "kickingPower",
      "puntingPower",
      "snapAccuracy",
    ],
  },
  S: {
    heightInches: 73,
    weightPounds: 210,
    heightSpread: 2,
    weightSpread: 12,
    signature: [
      "zoneCoverage",
      "tackling",
      "footballIq",
      "anticipation",
      "manCoverage",
      "speed",
    ],
    deEmphasized: [
      "armStrength",
      "passBlocking",
      "runBlocking",
      "catching",
      "routeRunning",
      "kickingPower",
      "puntingPower",
      "snapAccuracy",
    ],
  },
  K: {
    heightInches: 71,
    weightPounds: 195,
    heightSpread: 2,
    weightSpread: 10,
    signature: [
      "kickingPower",
      "kickingAccuracy",
      "composure",
      "clutch",
    ],
    deEmphasized: [
      "armStrength",
      "speed",
      "strength",
      "passBlocking",
      "runBlocking",
      "tackling",
      "manCoverage",
      "zoneCoverage",
      "puntingPower",
      "snapAccuracy",
    ],
  },
  P: {
    heightInches: 73,
    weightPounds: 210,
    heightSpread: 2,
    weightSpread: 10,
    signature: [
      "puntingPower",
      "puntingAccuracy",
      "composure",
    ],
    deEmphasized: [
      "armStrength",
      "speed",
      "strength",
      "passBlocking",
      "runBlocking",
      "tackling",
      "manCoverage",
      "zoneCoverage",
      "kickingPower",
      "snapAccuracy",
    ],
  },
  LS: {
    heightInches: 73,
    weightPounds: 240,
    heightSpread: 1,
    weightSpread: 10,
    signature: [
      "snapAccuracy",
      "tackling",
      "composure",
    ],
    deEmphasized: [
      "armStrength",
      "speed",
      "catching",
      "routeRunning",
      "manCoverage",
      "zoneCoverage",
      "kickingPower",
      "puntingPower",
    ],
  },
};

// Target roster composition by neutral bucket. FB is intentionally absent —
// lead-blocking fullbacks classify as RB under the neutral lens.
export const ROSTER_BUCKET_COMPOSITION: readonly {
  bucket: NeutralBucket;
  count: number;
}[] = [
  { bucket: "QB", count: 2 },
  { bucket: "RB", count: 4 },
  { bucket: "WR", count: 6 },
  { bucket: "TE", count: 3 },
  { bucket: "OT", count: 4 },
  { bucket: "IOL", count: 5 },
  { bucket: "EDGE", count: 4 },
  { bucket: "IDL", count: 4 },
  { bucket: "LB", count: 7 },
  { bucket: "CB", count: 6 },
  { bucket: "S", count: 5 },
  { bucket: "K", count: 1 },
  { bucket: "P", count: 1 },
  { bucket: "LS", count: 1 },
];

const ROSTER_BUCKET_SLOTS: readonly NeutralBucket[] = ROSTER_BUCKET_COMPOSITION
  .flatMap(({ bucket, count }) => Array.from({ length: count }, () => bucket));

const FREE_AGENT_BUCKET_CYCLE: readonly NeutralBucket[] = [...NEUTRAL_BUCKETS];

const FREE_AGENT_COUNT = 50;
const DRAFT_PROSPECT_COUNT = 250;

export const SALARY_FLOOR = 750_000;
export const SALARY_PER_QUALITY_POINT = 250_000;

const ROOKIE_SCALE_AGE_THRESHOLD = 25;

const PROSPECT_AGE_MIN = 20;
const PROSPECT_AGE_MAX = 23;

/**
 * Five-tier talent model sourced from
 * `data/docs/nfl-talent-distribution-by-position.md`. Each neutral
 * bucket has its own `tierMix` and `stddevScale` so the position
 * economy emerges naturally — QB is bimodal with fat tails, OL and
 * specialists compress around 50, EDGE is top-heavy, iDL/LB/S are
 * flat. The tier enum maps directly to the overall-band thresholds
 * used by `applyLeagueEliteCaps` (85+ elite, 95+ generational).
 */
export type QualityTier =
  | "elite"
  | "strong"
  | "average"
  | "weak"
  | "replacement";

export const QUALITY_TIERS: readonly QualityTier[] = [
  "elite",
  "strong",
  "average",
  "weak",
  "replacement",
];

export interface BucketQualityPrior {
  /**
   * Per-bucket spread multiplier. 1.0 is the baseline, <1 compresses
   * toward the mean (OL, specialists), >1 widens the tails
   * (QB, EDGE).
   */
  stddevScale: number;
  /**
   * Share of the bucket's population in each tier; sums to ~1.0.
   * Values are the midpoints of the ranges in the talent-distribution
   * doc. League-wide histograms converge on these at 32-team size.
   */
  tierMix: Record<QualityTier, number>;
}

export const BUCKET_QUALITY_PRIORS: Record<NeutralBucket, BucketQualityPrior> =
  {
    QB: {
      stddevScale: 1.35,
      tierMix: {
        elite: 0.07,
        strong: 0.18,
        average: 0.28,
        weak: 0.28,
        replacement: 0.19,
      },
    },
    RB: {
      stddevScale: 1.00,
      tierMix: {
        elite: 0.04,
        strong: 0.13,
        average: 0.33,
        weak: 0.28,
        replacement: 0.22,
      },
    },
    WR: {
      stddevScale: 1.00,
      tierMix: {
        elite: 0.04,
        strong: 0.14,
        average: 0.33,
        weak: 0.27,
        replacement: 0.22,
      },
    },
    TE: {
      stddevScale: 1.05,
      tierMix: {
        elite: 0.04,
        strong: 0.11,
        average: 0.23,
        weak: 0.28,
        replacement: 0.34,
      },
    },
    OT: {
      stddevScale: 0.70,
      tierMix: {
        elite: 0.04,
        strong: 0.18,
        average: 0.38,
        weak: 0.28,
        replacement: 0.12,
      },
    },
    IOL: {
      stddevScale: 0.70,
      tierMix: {
        elite: 0.04,
        strong: 0.18,
        average: 0.38,
        weak: 0.28,
        replacement: 0.12,
      },
    },
    EDGE: {
      stddevScale: 1.30,
      tierMix: {
        elite: 0.04,
        strong: 0.13,
        average: 0.33,
        weak: 0.28,
        replacement: 0.22,
      },
    },
    IDL: {
      stddevScale: 1.00,
      tierMix: {
        elite: 0.03,
        strong: 0.13,
        average: 0.38,
        weak: 0.28,
        replacement: 0.18,
      },
    },
    LB: {
      stddevScale: 1.00,
      tierMix: {
        elite: 0.03,
        strong: 0.13,
        average: 0.38,
        weak: 0.28,
        replacement: 0.18,
      },
    },
    CB: {
      stddevScale: 1.05,
      tierMix: {
        elite: 0.04,
        strong: 0.13,
        average: 0.33,
        weak: 0.28,
        replacement: 0.22,
      },
    },
    S: {
      stddevScale: 1.00,
      tierMix: {
        elite: 0.03,
        strong: 0.13,
        average: 0.38,
        weak: 0.28,
        replacement: 0.18,
      },
    },
    K: {
      stddevScale: 0.70,
      tierMix: {
        elite: 0.06,
        strong: 0.23,
        average: 0.38,
        weak: 0.23,
        replacement: 0.10,
      },
    },
    P: {
      stddevScale: 0.60,
      tierMix: {
        elite: 0.03,
        strong: 0.20,
        average: 0.50,
        weak: 0.20,
        replacement: 0.07,
      },
    },
    LS: {
      stddevScale: 0.50,
      tierMix: {
        elite: 0.02,
        strong: 0.15,
        average: 0.60,
        weak: 0.15,
        replacement: 0.08,
      },
    },
  };

/**
 * Tier-quality centers anchored to the Geno Smith Line in
 * `docs/product/north-star/player-attributes.md` — 50 is the
 * starter/backup boundary, 85+ elite, 95+ generational. Per-bucket
 * `stddevScale` widens or compresses the spread around these centers
 * so tight-distribution buckets (OL, specialists) cluster near the
 * mean while wide-distribution buckets (QB, EDGE) let the elite tier
 * ride further up the tail.
 */
const TIER_CENTERS: Record<QualityTier, number> = {
  elite: 88,
  strong: 72,
  average: 54,
  weak: 40,
  replacement: 25,
};

const TIER_SPREADS: Record<QualityTier, number> = {
  elite: 4,
  strong: 5,
  average: 6,
  weak: 5,
  replacement: 6,
};

function rollQuality(
  rng: SeededRng,
  bucket: NeutralBucket,
  tier: QualityTier,
): number {
  const prior = BUCKET_QUALITY_PRIORS[bucket];
  const mean = TIER_CENTERS[tier];
  const stddev = TIER_SPREADS[tier] * prior.stddevScale;
  return rng.gaussian(mean, stddev, 1, 99);
}

/**
 * Samples a quality tier for a specific per-team depth-chart slot.
 * The tier mix comes from the bucket's prior, but slot position
 * biases the draw so slot 0 (starter) leans toward the top tiers and
 * the last slot (backup) leans toward the bottom. The symmetric bias
 * averages out across slots so the league-wide tier % still converges
 * on `tierMix` at 32-team scale.
 */
export function qualityTierForBucketSlot(
  rng: SeededRng,
  bucket: NeutralBucket,
  indexInBucket: number,
  bucketCount: number,
): QualityTier {
  const prior = BUCKET_QUALITY_PRIORS[bucket];
  // Single-slot buckets (K, P, LS) have no starter/backup distinction
  // so we sample without slot bias — otherwise the symmetric bias
  // would always treat them as a "starter" and inflate their elite
  // share above the talent-doc target.
  const depthRatio = bucketCount <= 1
    ? 0.5
    : Math.min(1, indexInBucket / (bucketCount - 1));
  const weights = QUALITY_TIERS.map((tier, idx) => {
    const tierPosition = idx / (QUALITY_TIERS.length - 1);
    // `alignment` is 1 when the tier's rank matches the slot's depth
    // (top slot ↔ elite tier, bottom slot ↔ replacement) and falls
    // linearly to 0 at the opposite end.
    const alignment = 1 - Math.abs(depthRatio - tierPosition);
    const boost = 1 + alignment;
    return prior.tierMix[tier] * boost;
  });
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng.next() * total;
  for (let i = 0; i < QUALITY_TIERS.length; i++) {
    r -= weights[i];
    if (r <= 0) return QUALITY_TIERS[i];
  }
  return "replacement";
}

// Signature attributes float above a higher floor than the rest because
// `lockInBucket` reclassifies via the signature set — if a depth-tier
// player's signature attrs can clamp all the way down to the practice-
// squad band, the classifier can't pull him back into his intended
// bucket within the 20-iter cap. Non-signature attributes still use a
// lower floor so de-emphasized skills can sink into the 1-14 "shouldn't
// be on a pro field" band the scale contract describes.
const SIGNATURE_ATTR_FLOOR = 15;
const NON_SIGNATURE_ATTR_FLOOR = 5;

function rollAttributesFor(
  rng: SeededRng,
  bucket: NeutralBucket,
  quality: number,
): PlayerAttributes {
  const profile = BUCKET_PROFILES[bucket];
  const signatureSet = new Set<PlayerAttributeKey>(profile.signature);
  const deEmphasizedSet = new Set<PlayerAttributeKey>(profile.deEmphasized);

  const attrs: Record<string, number> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    let mean: number;
    let floor: number;
    if (signatureSet.has(key)) {
      mean = quality + 10;
      floor = SIGNATURE_ATTR_FLOOR;
    } else if (deEmphasizedSet.has(key)) {
      mean = Math.round(quality * 0.55);
      floor = NON_SIGNATURE_ATTR_FLOOR;
    } else {
      mean = Math.round(quality * 0.85);
      floor = NON_SIGNATURE_ATTR_FLOOR;
    }
    attrs[key] = rng.gaussian(mean, 5, floor, 99);
  }
  return attrs as PlayerAttributes;
}

/**
 * Bucket signatures overlap (OT and IOL share run/pass block, LB and S share
 * tackling + zone coverage, etc.), so a purely random roll can classify a
 * player under the wrong bucket even when their size + profile match the
 * intended archetype. This step bumps the intended bucket's signature
 * attributes until the `neutralBucket()` classifier picks the intended
 * bucket — a deterministic post-condition that keeps per-team roster
 * composition stable while still allowing meaningful distribution variance.
 */
function lockInBucket(
  attributes: PlayerAttributes,
  bucket: NeutralBucket,
  heightInches: number,
  weightPounds: number,
): void {
  const rec = attributes as unknown as Record<string, number>;
  const profile = BUCKET_PROFILES[bucket];
  // Per-bucket quality priors push more players into the replacement
  // tier than the previous single-distribution model, and adjacent
  // buckets (TE/WR, LB/S) can share enough signature attributes that
  // uniform lifts don't always break a tie. 100 iterations of +3
  // saturates signature attrs to 99 and, as a fallback, pins any
  // competing bucket's signature keys that aren't also ours down to
  // zero — guaranteeing convergence for every valid size + bucket
  // combination.
  const MAX_ITERS = 100;
  const ownSignature = new Set<PlayerAttributeKey>(profile.signature);
  for (let iter = 0; iter < MAX_ITERS; iter++) {
    const classified = neutralBucket({
      attributes,
      heightInches,
      weightPounds,
    });
    if (classified === bucket) return;
    for (const key of profile.signature) {
      rec[key] = Math.min(99, rec[key] + 3);
    }
    // Once our signature keys saturate, push the competing bucket's
    // exclusive signature keys down so the classifier has a clean
    // margin. We only touch keys the intended bucket doesn't rely on
    // itself — keys shared across buckets stay untouched.
    if (iter >= 30) {
      const competing = BUCKET_PROFILES[classified];
      for (const key of competing.signature) {
        if (!ownSignature.has(key)) {
          rec[key] = Math.max(0, rec[key] - 3);
        }
      }
    }
  }
}

function rollPotentials(
  rng: SeededRng,
  attributes: PlayerAttributes,
  age: number,
): void {
  const rec = attributes as unknown as Record<string, number>;
  let liftMax: number;
  if (age <= 22) liftMax = 18;
  else if (age <= 25) liftMax = 12;
  else if (age <= 28) liftMax = 7;
  else if (age <= 31) liftMax = 4;
  else liftMax = 2;
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    const current = rec[key];
    const lift = rng.int(0, liftMax);
    rec[`${key}Potential`] = clamp(current + lift, current, 99);
  }
}

function rollHeightWeight(rng: SeededRng, bucket: NeutralBucket): {
  heightInches: number;
  weightPounds: number;
} {
  const profile = BUCKET_PROFILES[bucket];
  const heightInches = profile.heightInches +
    rng.int(-profile.heightSpread, profile.heightSpread);
  const weightPounds = profile.weightPounds +
    rng.int(-profile.weightSpread, profile.weightSpread);
  return { heightInches, weightPounds };
}

function rollAge(
  rng: SeededRng,
  status: "rostered" | "free-agent" | "prospect",
  bucket: NeutralBucket,
): number {
  if (status === "prospect") {
    return rng.int(PROSPECT_AGE_MIN, PROSPECT_AGE_MAX);
  }
  // Active / free-agent ages follow a position-conditioned cohort
  // survival curve so RB/CB cliff near 28, OL plateau into mid-30s,
  // QB keep a long tail past 36, and specialists (K/P/LS) extend past
  // 40 — all real shapes the prior uniform 21–36 triangular erased.
  return sampleBucketAge(rng.next, bucket);
}

function birthDateForAge(
  age: number,
  currentYear: number,
  rng: SeededRng,
): string {
  const year = currentYear - age;
  const month = rng.int(1, 12);
  const day = rng.int(1, 28);
  return `${year}-${String(month).padStart(2, "0")}-${
    String(day).padStart(2, "0")
  }`;
}

function pickCollege(rng: SeededRng): string {
  return rng.pick(DEFAULT_COLLEGES).shortName;
}

function pickHometown(rng: SeededRng): string {
  const city = rng.pick(DEFAULT_CITIES);
  return `${city.name}, ${city.stateCode}`;
}

function rollOrigin(
  rng: SeededRng,
  age: number,
  currentYear: number,
  draftingTeamId: string | null,
): {
  hometown: string;
  draftYear: number | null;
  draftRound: number | null;
  draftPick: number | null;
  draftingTeamId: string | null;
} {
  const hometown = pickHometown(rng);
  // ~12% undrafted among active players — roughly matches NFL roster shape.
  const undrafted = rng.next() < 0.12;
  if (undrafted) {
    return {
      hometown,
      draftYear: null,
      draftRound: null,
      draftPick: null,
      draftingTeamId: null,
    };
  }
  const yearsAgo = Math.max(0, age - 22);
  const draftYear = currentYear - yearsAgo;
  const round = rng.int(1, 7);
  const pickInRound = rng.int(1, 32);
  const draftPick = (round - 1) * 32 + pickInRound;
  return {
    hometown,
    draftYear,
    draftRound: round,
    draftPick,
    draftingTeamId,
  };
}

interface ArchetypeShapeParams {
  bonusRatioMin: number;
  bonusRatioMax: number;
  voidYearChance: number;
  maxVoidYears: number;
}

const ARCHETYPE_SHAPE: Record<CapArchetype, ArchetypeShapeParams> = {
  "cap-hell": {
    bonusRatioMin: 0.45,
    bonusRatioMax: 0.65,
    voidYearChance: 0.6,
    maxVoidYears: 2,
  },
  tight: {
    bonusRatioMin: 0.30,
    bonusRatioMax: 0.50,
    voidYearChance: 0.3,
    maxVoidYears: 1,
  },
  balanced: {
    bonusRatioMin: 0.25,
    bonusRatioMax: 0.45,
    voidYearChance: 0.15,
    maxVoidYears: 1,
  },
  flush: {
    bonusRatioMin: 0.08,
    bonusRatioMax: 0.22,
    voidYearChance: 0.0,
    maxVoidYears: 0,
  },
};

const ROOKIE_SLOTTED_MAX = 40_000_000;
const ROOKIE_SLOTTED_MIN = 4_000_000;
const ROOKIE_MAX_PICK = 224;
const ROOKIE_DEAL_YEARS = 4;
const ROOKIE_BONUS_RATIO = 0.15;

function rookieSlottedValue(draftPick: number): number {
  const normalized = Math.max(
    0,
    Math.min(1, (draftPick - 1) / (ROOKIE_MAX_PICK - 1)),
  );
  const factor = Math.pow(1 - normalized, 1.5);
  return Math.round(
    ROOKIE_SLOTTED_MIN + (ROOKIE_SLOTTED_MAX - ROOKIE_SLOTTED_MIN) * factor,
  );
}

interface RolledContractBundle {
  contract: GeneratedContract;
  years: GeneratedContractYear[];
  bonusProrations: GeneratedBonusProration[];
  annualBase: number;
}

function rollContract(
  rng: SeededRng,
  args: {
    playerId: string;
    teamId: string;
    bucket: NeutralBucket;
    quality: number;
    age: number;
    signedYear: number;
    archetype: CapArchetype;
  },
  multiplierFn: SalaryMultiplierFn,
): RolledContractBundle {
  const isRookie = args.age <= ROOKIE_SCALE_AGE_THRESHOLD;

  if (isRookie) {
    return rollRookieContract(rng, args);
  }

  return rollVeteranContract(rng, args, multiplierFn);
}

function rollRookieContract(
  rng: SeededRng,
  args: {
    playerId: string;
    teamId: string;
    quality: number;
    age: number;
    signedYear: number;
  },
): RolledContractBundle {
  const draftPick = rng.int(1, ROOKIE_MAX_PICK);
  const totalValue = rookieSlottedValue(draftPick);
  const signingBonus = Math.round(totalValue * ROOKIE_BONUS_RATIO);
  const remainingBase = totalValue - signingBonus;
  const annualBase = Math.max(1, Math.floor(remainingBase / ROOKIE_DEAL_YEARS));
  const residue = remainingBase - annualBase * ROOKIE_DEAL_YEARS;

  const years: GeneratedContractYear[] = [];
  for (let i = 0; i < ROOKIE_DEAL_YEARS; i++) {
    years.push({
      leagueYear: args.signedYear + i,
      base: annualBase + (i === ROOKIE_DEAL_YEARS - 1 ? residue : 0),
      rosterBonus: 0,
      workoutBonus: 0,
      perGameRosterBonus: 0,
      guaranteeType: i < 2 ? "full" : "none",
      isVoid: false,
    });
  }

  const bonusProrations: GeneratedBonusProration[] = [];
  if (signingBonus > 0) {
    bonusProrations.push({
      amount: signingBonus,
      firstYear: args.signedYear,
      years: Math.min(ROOKIE_DEAL_YEARS, 5),
      source: "signing",
    });
  }

  return {
    contract: {
      playerId: args.playerId,
      teamId: args.teamId,
      signedYear: args.signedYear,
      totalYears: ROOKIE_DEAL_YEARS,
      realYears: ROOKIE_DEAL_YEARS,
      signingBonus,
      isRookieDeal: true,
      rookieDraftPick: draftPick,
      tagType: null,
    },
    years,
    bonusProrations,
    annualBase,
  };
}

function rollVeteranContract(
  rng: SeededRng,
  args: {
    playerId: string;
    teamId: string;
    bucket: NeutralBucket;
    quality: number;
    age: number;
    signedYear: number;
    archetype: CapArchetype;
  },
  multiplierFn: SalaryMultiplierFn,
): RolledContractBundle {
  const shape = ARCHETYPE_SHAPE[args.archetype];
  const mult = multiplierFn(args.bucket, args.quality);
  const excess = Math.max(0, args.quality - 50);
  const baseSalary = SALARY_FLOOR + excess * SALARY_PER_QUALITY_POINT * mult;
  const jitter = 0.9 + rng.next() * 0.2;
  const annualBase = Math.max(SALARY_FLOOR, Math.round(baseSalary * jitter));

  let realYears: number;
  if (args.age >= 32) realYears = rng.int(1, 2);
  else if (args.quality >= 80) realYears = rng.int(3, 5);
  else if (args.quality >= 65) realYears = rng.int(2, 4);
  else realYears = rng.int(1, 3);

  const totalValue = annualBase * realYears;

  const bonusRatio = shape.bonusRatioMin +
    rng.next() * (shape.bonusRatioMax - shape.bonusRatioMin);
  const signingBonus = Math.round(totalValue * bonusRatio);
  const remainingBase = totalValue - signingBonus;

  let voidYears = 0;
  if (
    shape.maxVoidYears > 0 && realYears >= 2 &&
    rng.next() < shape.voidYearChance
  ) {
    voidYears = rng.int(1, shape.maxVoidYears);
  }
  const totalYears = realYears + voidYears;

  const perYearBase = Math.max(1, Math.floor(remainingBase / realYears));
  const baseResidue = remainingBase - perYearBase * realYears;

  const guaranteedPct = args.quality >= 80
    ? 0.5 + rng.next() * 0.2
    : args.quality >= 65
    ? 0.2 + rng.next() * 0.2
    : 0.05 + rng.next() * 0.1;
  const guaranteedYears = Math.max(
    1,
    Math.round(guaranteedPct * realYears),
  );

  const years: GeneratedContractYear[] = [];
  for (let i = 0; i < realYears; i++) {
    const guaranteeType: ContractGuaranteeType = i < guaranteedYears
      ? "full"
      : "none";
    years.push({
      leagueYear: args.signedYear + i,
      base: perYearBase + (i === realYears - 1 ? baseResidue : 0),
      rosterBonus: 0,
      workoutBonus: 0,
      perGameRosterBonus: 0,
      guaranteeType,
      isVoid: false,
    });
  }

  for (let i = 0; i < voidYears; i++) {
    years.push({
      leagueYear: args.signedYear + realYears + i,
      base: 0,
      rosterBonus: 0,
      workoutBonus: 0,
      perGameRosterBonus: 0,
      guaranteeType: "none",
      isVoid: true,
    });
  }

  const bonusProrations: GeneratedBonusProration[] = [];
  if (signingBonus > 0) {
    bonusProrations.push({
      amount: signingBonus,
      firstYear: args.signedYear,
      years: Math.min(totalYears, 5),
      source: "signing",
    });
  }

  return {
    contract: {
      playerId: args.playerId,
      teamId: args.teamId,
      signedYear: args.signedYear,
      totalYears,
      realYears,
      signingBonus,
      isRookieDeal: false,
      rookieDraftPick: null,
      tagType: null,
    },
    years,
    bonusProrations,
    annualBase,
  };
}

/**
 * Per-bucket elite-tier caps, sourced from
 * `data/docs/nfl-talent-distribution-by-position.md`. Each neutral
 * bucket has its own elite share (`tierMix.elite` in
 * `BUCKET_QUALITY_PRIORS`), so the league-wide 85+ budget is derived
 * per-bucket rather than as a single pooled total. This lets QB
 * scarcity, OL compression, and EDGE top-heaviness emerge naturally
 * — a 32-team league gets ~4 elite QBs, ~5 elite OTs, ~6 elite EDGEs,
 * etc., instead of a flat 10 elites distributed by random chance.
 *
 * 95+ (generational) "may not exist in any given season" and are
 * "one per decade per position" — implemented as at most one per
 * neutral bucket per league.
 *
 * Independent rolls can exceed the per-bucket budget — this pass
 * sorts each bucket's rostered pool by signature overall and pushes
 * the excess just below the threshold (elite capped to 84,
 * generational capped to 94) by subtracting a flat delta from every
 * signature attribute. Bucket classification is unaffected because
 * all signature attributes move together and by the same amount.
 */
export const ELITE_OVERALL_THRESHOLD = 85;
export const GENERATIONAL_OVERALL_THRESHOLD = 95;

/**
 * Headroom (in overall points) the cap pass leaves below the
 * threshold so `lockInBucket`'s signature lifts can re-classify a
 * pushed-down player without bumping their signature back over the
 * cap. Empirically tuned: ~3 lift per iter × ~3 iters of slop is
 * comfortably absorbed.
 */
const LOCK_BUFFER = 10;

export function eliteBudgetForBucket(
  bucket: NeutralBucket,
  bucketPopulation: number,
): number {
  if (bucketPopulation <= 0) return 0;
  const elitePct = BUCKET_QUALITY_PRIORS[bucket].tierMix.elite;
  // `Math.max(1, ...)` keeps small test leagues interesting — a 3-team
  // sample can still surface a franchise player at each position —
  // while 32-team leagues round to the per-bucket NFL target.
  return Math.max(1, Math.round(elitePct * bucketPopulation));
}

function signatureOverall(
  attributes: PlayerAttributes,
  bucket: NeutralBucket,
): number {
  const profile = BUCKET_PROFILES[bucket];
  const rec = attributes as unknown as Record<string, number>;
  let sum = 0;
  for (const key of profile.signature) sum += rec[key];
  return sum / profile.signature.length;
}

function pushBelowOverall(
  attributes: PlayerAttributes,
  bucket: NeutralBucket,
  targetOverall: number,
): void {
  const profile = BUCKET_PROFILES[bucket];
  const rec = attributes as unknown as Record<string, number>;
  const current = signatureOverall(attributes, bucket);
  if (current <= targetOverall) return;
  const delta = Math.ceil(current - targetOverall);
  for (const key of profile.signature) {
    rec[key] = Math.max(0, rec[key] - delta);
  }
}

interface ClassifiedEntry {
  attributes: PlayerAttributes;
  bucket: NeutralBucket;
  overall: number;
  /** Original size — used to re-lock the bucket after capping. */
  heightInches: number;
  weightPounds: number;
}

function classifyForCap(
  entries: ReadonlyArray<EliteCapEntry>,
): ClassifiedEntry[] {
  return entries.map((e) => ({
    attributes: e.attributes,
    bucket: e.intendedBucket,
    overall: signatureOverall(e.attributes, e.intendedBucket),
    heightInches: e.player.heightInches,
    weightPounds: e.player.weightPounds,
  }));
}

export interface EliteCapEntry {
  player: { heightInches: number; weightPounds: number };
  attributes: PlayerAttributes;
  /**
   * The bucket the generator intended this player to fill on the
   * roster. Cap budgets are sized per intended bucket (so a 32-team
   * league always has ~64 QB slots regardless of how the classifier
   * sees individual rolls), and `lockInBucket` is re-run after each
   * push so the cap pass never accidentally flips a player out of
   * the bucket that owns their roster slot.
   */
  intendedBucket: NeutralBucket;
}

export function applyLeagueEliteCaps(
  entries: ReadonlyArray<EliteCapEntry>,
  teamCount: number,
): void {
  if (entries.length === 0 || teamCount === 0) return;

  // Capping a player's signature attrs can shift his neutral-bucket
  // classification (non-signature attrs become relatively higher). We
  // reclassify and re-cap until the league settles under every
  // bucket's budget, up to a generous iteration cap. Each iteration
  // can only reduce a player's signature overall, never raise it, so
  // the fixed point converges quickly.
  const MAX_SWEEPS = 8;
  for (let sweep = 0; sweep < MAX_SWEEPS; sweep++) {
    const classified = classifyForCap(entries);

    const byBucket = new Map<NeutralBucket, ClassifiedEntry[]>();
    for (const c of classified) {
      const list = byBucket.get(c.bucket) ?? [];
      list.push(c);
      byBucket.set(c.bucket, list);
    }
    let changed = false;

    for (const [bucket, list] of byBucket) {
      // Generational (95+) cap: at most one per bucket per league.
      const generationals = list
        .filter((c) => c.overall >= GENERATIONAL_OVERALL_THRESHOLD)
        .sort((a, b) => b.overall - a.overall);
      for (let i = 1; i < generationals.length; i++) {
        pushBelowOverall(
          generationals[i].attributes,
          generationals[i].bucket,
          GENERATIONAL_OVERALL_THRESHOLD - LOCK_BUFFER,
        );
        lockInBucket(
          generationals[i].attributes,
          generationals[i].bucket,
          generationals[i].heightInches,
          generationals[i].weightPounds,
        );
        changed = true;
      }

      // Per-bucket 85+ cap. QB/EDGE get more elites than OL/specialists
      // because their `tierMix.elite` share is higher.
      const budget = eliteBudgetForBucket(bucket, list.length);
      const elites = list
        .filter((c) => c.overall >= ELITE_OVERALL_THRESHOLD)
        .sort((a, b) => b.overall - a.overall);
      for (let i = budget; i < elites.length; i++) {
        pushBelowOverall(
          elites[i].attributes,
          elites[i].bucket,
          ELITE_OVERALL_THRESHOLD - LOCK_BUFFER,
        );
        // Re-lock after capping so the classifier still places the
        // player in their intended bucket. The `LOCK_BUFFER` margin
        // gives `lockInBucket`'s +3-per-iter signature bumps room to
        // re-classify without pushing the player back above the
        // threshold — otherwise the cap and lock pingpong every
        // sweep and the budget never settles.
        lockInBucket(
          elites[i].attributes,
          elites[i].bucket,
          elites[i].heightInches,
          elites[i].weightPounds,
        );
        changed = true;
      }
    }

    if (!changed) return;
  }
}

/**
 * Deterministic attribute profile for a bucket — used by repository/integration
 * tests that need a classifiable attribute set without running the full
 * randomized generator. Each signature attribute is lifted above baseline so
 * `neutralBucket()` classifies the owner into the intended bucket.
 */
export function stubAttributesFor(bucket: NeutralBucket): PlayerAttributes {
  const profile = BUCKET_PROFILES[bucket];
  const BASELINE = 30;
  const SIGNATURE = 60;
  const POTENTIAL = 65;
  const signatureSet = new Set<PlayerAttributeKey>(profile.signature);
  const attrs: Record<string, number> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    const current = signatureSet.has(key) ? SIGNATURE : BASELINE;
    attrs[key] = current;
    attrs[`${key}Potential`] = Math.max(current, POTENTIAL);
  }
  return attrs as PlayerAttributes;
}

export type SalaryMultiplierFn = (
  position: NeutralBucket,
  quality: number,
) => number;

export interface PlayersGeneratorOptions {
  nameGenerator?: NameGenerator;
  random?: () => number;
  currentYear?: number;
  salaryMultiplier?: SalaryMultiplierFn;
}

export function createPlayersGenerator(
  options: PlayersGeneratorOptions = {},
): PlayersGenerator {
  const random = options.random ?? Math.random;
  const rng = createRng(random);
  const nameGenerator = options.nameGenerator ?? createNameGenerator();
  const currentYear = options.currentYear ?? new Date().getUTCFullYear();
  const salaryMultiplier = options.salaryMultiplier ??
    positionalSalaryMultiplier;

  function buildPlayer(args: {
    leagueId: string;
    teamId: string | null;
    status: "active" | "prospect";
    bucket: NeutralBucket;
    indexInBucket: number;
    bucketCount: number;
    draftingTeamId: string | null;
    statusKind: "rostered" | "free-agent" | "prospect";
  }) {
    const tier = qualityTierForBucketSlot(
      rng,
      args.bucket,
      args.indexInBucket,
      args.bucketCount,
    );
    const quality = rollQuality(rng, args.bucket, tier);
    const age = rollAge(rng, args.statusKind, args.bucket);
    const { heightInches, weightPounds } = rollHeightWeight(rng, args.bucket);
    const attributes = rollAttributesFor(rng, args.bucket, quality);
    lockInBucket(attributes, args.bucket, heightInches, weightPounds);
    rollPotentials(rng, attributes, age);
    const { firstName, lastName } = nameGenerator.next();
    const origin = args.statusKind === "prospect"
      ? {
        hometown: pickHometown(rng),
        draftYear: null,
        draftRound: null,
        draftPick: null,
        draftingTeamId: null,
      }
      : rollOrigin(rng, age, currentYear, args.draftingTeamId);
    return {
      player: {
        leagueId: args.leagueId,
        teamId: args.teamId,
        status: args.status,
        firstName,
        lastName,
        jerseyNumber: null,
        injuryStatus: "healthy" as const,
        heightInches,
        weightPounds,
        college: pickCollege(rng),
        birthDate: birthDateForAge(age, currentYear, rng),
        ...origin,
      },
      attributes,
    };
  }

  return {
    generate(input: PlayersGeneratorInput): GeneratedPlayers {
      const players: GeneratedPlayers["players"] = [];
      const rosteredEntries: EliteCapEntry[] = [];

      for (const teamId of input.teamIds) {
        const bucketIndex = new Map<NeutralBucket, number>();
        const bucketTotal = new Map<NeutralBucket, number>();
        for (const { bucket, count } of ROSTER_BUCKET_COMPOSITION) {
          bucketTotal.set(bucket, count);
        }
        for (let i = 0; i < input.rosterSize; i++) {
          const bucket = ROSTER_BUCKET_SLOTS[i % ROSTER_BUCKET_SLOTS.length];
          const indexInBucket = bucketIndex.get(bucket) ?? 0;
          bucketIndex.set(bucket, indexInBucket + 1);
          const entry = buildPlayer({
            leagueId: input.leagueId,
            teamId,
            status: "active",
            bucket,
            indexInBucket,
            bucketCount: bucketTotal.get(bucket) ?? 1,
            draftingTeamId: teamId,
            statusKind: "rostered",
          });
          players.push(entry);
          rosteredEntries.push({ ...entry, intendedBucket: bucket });
        }
      }

      // Apply per-bucket elite-tier budgets across the rostered pool.
      // Free agents and prospects live outside the per-bucket budgets
      // — FAs are index-biased toward depth, and the draft class is a
      // one-year wave rather than the steady league population the
      // talent doc quantifies.
      applyLeagueEliteCaps(rosteredEntries, input.teamIds.length);
      // Potentials were rolled against the pre-cap current, which can
      // leave a capped player's ceiling below his post-cap current. Re-
      // sync each signature attribute's potential so `potential >=
      // current` still holds without re-rolling the whole attribute set.
      for (const entry of rosteredEntries) {
        const rec = entry.attributes as unknown as Record<string, number>;
        for (const key of PLAYER_ATTRIBUTE_KEYS) {
          if (rec[`${key}Potential`] < rec[key]) {
            rec[`${key}Potential`] = rec[key];
          }
        }
      }

      for (let i = 0; i < FREE_AGENT_COUNT; i++) {
        const bucket =
          FREE_AGENT_BUCKET_CYCLE[i % FREE_AGENT_BUCKET_CYCLE.length];
        players.push(
          buildPlayer({
            leagueId: input.leagueId,
            teamId: null,
            status: "active",
            bucket,
            indexInBucket: 2 + i, // biases toward depth tier
            bucketCount: FREE_AGENT_COUNT,
            draftingTeamId: null,
            statusKind: "free-agent",
          }),
        );
      }

      for (let i = 0; i < DRAFT_PROSPECT_COUNT; i++) {
        const bucket =
          FREE_AGENT_BUCKET_CYCLE[i % FREE_AGENT_BUCKET_CYCLE.length];
        const indexInBucket = Math.floor(i / FREE_AGENT_BUCKET_CYCLE.length);
        players.push(
          buildPlayer({
            leagueId: input.leagueId,
            teamId: null,
            status: "prospect",
            bucket,
            indexInBucket,
            bucketCount: Math.ceil(
              DRAFT_PROSPECT_COUNT / FREE_AGENT_BUCKET_CYCLE.length,
            ),
            draftingTeamId: null,
            statusKind: "prospect",
          }),
        );
      }

      return { players };
    },

    generateContracts(
      input: ContractGeneratorInput,
    ): GeneratedContractBundle[] {
      const rostered = input.players.filter(
        (p): p is typeof p & { teamId: string } => p.teamId !== null,
      );
      if (rostered.length === 0) return [];

      const byTeam = new Map<string, typeof rostered>();
      for (const p of rostered) {
        const list = byTeam.get(p.teamId) ?? [];
        list.push(p);
        byTeam.set(p.teamId, list);
      }

      const bundles: GeneratedContractBundle[] = [];
      for (const [teamId, teamPlayers] of byTeam) {
        const archetype: CapArchetype = input.teamArchetypes?.get(teamId) ??
          "balanced";
        const rawBundles = teamPlayers.map((p, idx) => {
          const bucket = ROSTER_BUCKET_SLOTS[idx % ROSTER_BUCKET_SLOTS.length];
          const bucketCount = ROSTER_BUCKET_COMPOSITION.find((c) =>
            c.bucket === bucket
          )?.count ??
            1;
          const indexInBucket = Math.floor(
            idx / ROSTER_BUCKET_COMPOSITION.length,
          );
          const tier = qualityTierForBucketSlot(
            rng,
            bucket,
            indexInBucket,
            bucketCount,
          );
          const quality = rollQuality(rng, bucket, tier);
          const age = rollAge(rng, "rostered", bucket);
          return rollContract(
            rng,
            {
              playerId: p.id,
              teamId,
              bucket,
              quality,
              age,
              signedYear: currentYear,
              archetype,
            },
            salaryMultiplier,
          );
        });
        const teamAnnualTotal = rawBundles.reduce(
          (s, b) => s + b.annualBase,
          0,
        );
        const scale = teamAnnualTotal > input.salaryCap
          ? input.salaryCap / teamAnnualTotal
          : 1;
        for (const b of rawBundles) {
          const scaledSigningBonus = Math.round(
            b.contract.signingBonus * scale,
          );
          const scaledRealBase = b.years
            .filter((y) => !y.isVoid)
            .reduce((s, y) => s + y.base, 0);
          const scaledTotalValue = Math.round(scaledRealBase * scale) +
            scaledSigningBonus;
          const scaledYears = b.years.map((y) => ({
            ...y,
            base: y.isVoid ? 0 : Math.max(1, Math.floor(y.base * scale)),
          }));
          const realYears = scaledYears.filter((y) => !y.isVoid);
          if (realYears.length > 0) {
            const scaledBaseSum = realYears.reduce((s, y) => s + y.base, 0);
            const targetBase = scaledTotalValue - scaledSigningBonus;
            const diff = targetBase - scaledBaseSum;
            if (diff !== 0) {
              realYears[realYears.length - 1].base += diff;
            }
          }
          const scaledProrations = b.bonusProrations.map((p) => ({
            ...p,
            amount: Math.round(p.amount * scale),
          }));
          bundles.push({
            contract: {
              ...b.contract,
              signingBonus: scaledSigningBonus,
            },
            years: scaledYears,
            bonusProrations: scaledProrations.filter((p) => p.amount > 0),
          });
        }
      }
      return bundles;
    },
  };
}
