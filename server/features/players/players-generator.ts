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
import {
  bucketToContractPosition,
  getContractStructurePrior,
  type QualityTier,
  qualityTierToContractTier,
} from "./contract-structure-bands.ts";

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
// lead-blocking fullbacks classify as RB under the neutral lens. Counts are
// calibrated to `data/bands/position-market.json` (mean ACT slots per
// team-week, 2020-2024) within ±0.5 per bucket: combined OL = 8 (data 8.02),
// combined DL = 7 (data 7.03), combined DB = 9 (data 9.22).
export const ROSTER_BUCKET_COMPOSITION: readonly {
  bucket: NeutralBucket;
  count: number;
}[] = [
  { bucket: "QB", count: 2 },
  { bucket: "RB", count: 4 },
  { bucket: "WR", count: 5 },
  { bucket: "TE", count: 3 },
  { bucket: "OT", count: 4 },
  { bucket: "IOL", count: 4 },
  { bucket: "EDGE", count: 4 },
  { bucket: "IDL", count: 3 },
  { bucket: "LB", count: 7 },
  { bucket: "CB", count: 5 },
  { bucket: "S", count: 4 },
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
 * Rolls an overall-quality score anchored to the Geno Smith Line — the
 * 0–100 scale contract in `docs/product/north-star/player-attributes.md`
 * where 50 is the starter/backup boundary, franchise players sit 70+,
 * elite sit 85+, and the population peaks in the backup band (35–40).
 *
 * Tier means are chosen so the league-wide rostered average lands in
 * the lower half of the starter band and the league mode sits in the
 * backup band — not the inflated 58/70/82 scale that treated 0–100 as
 * 30–95 in disguise. Elite (85+) and generational (95+) outcomes come
 * from the bell's upper tail; `applyLeagueEliteCaps` trims any excess
 * to the rarity the spec mandates.
 */
function rollQuality(
  rng: SeededRng,
  tier: "star" | "starter" | "depth",
): number {
  const mean = tier === "star" ? 55 : tier === "starter" ? 40 : 28;
  const stddev = tier === "star" ? 10 : tier === "starter" ? 7 : 7;
  return rng.gaussian(mean, stddev, 1, 99);
}

/**
 * Assigns tier slots within a bucket. The prior split (one star, top
 * half as starters, rest depth) over-populated the starter band — a
 * 53-man roster realistically carries ~22 starters, not ~34. The new
 * split gives each bucket one star, ~1/5 of the bucket as starters,
 * and the rest as depth. Combined with the rescaled `rollQuality`
 * means this produces a right-skewed, backup-heavy roster whose modal
 * player is in the depth band (30-40) — the Geno Smith Line shape the
 * north-star doc mandates.
 */
function qualityTierForIndex(
  indexInBucket: number,
  bucketCount: number,
): "star" | "starter" | "depth" {
  if (bucketCount <= 1) return "starter";
  if (indexInBucket === 0) return "star";
  const starterCount = Math.max(1, Math.ceil(bucketCount / 5));
  if (indexInBucket <= starterCount) return "starter";
  return "depth";
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
  // +3 per iteration × 30 iterations gives up to +90 signature headroom,
  // enough to reclassify a low-quality depth player whose rolled
  // signature attrs landed at the practice-squad floor while his size
  // still matches his intended bucket.
  const MAX_ITERS = 30;
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

/**
 * Archetype-driven modifiers applied on top of the position × tier
 * contract-structure prior (see `contract-structure-bands.ts`). Real
 * NFL deals are shaped by position × market tier first; team cap
 * posture nudges the bonus share up/down and governs void-year usage.
 */
interface ArchetypeModifier {
  /** Additive delta applied to the sampled signing-bonus share. */
  bonusShareDelta: number;
  voidYearChance: number;
  maxVoidYears: number;
}

const ARCHETYPE_MODIFIER: Record<CapArchetype, ArchetypeModifier> = {
  "cap-hell": {
    bonusShareDelta: 0.20,
    voidYearChance: 0.6,
    maxVoidYears: 2,
  },
  tight: {
    bonusShareDelta: 0.10,
    voidYearChance: 0.3,
    maxVoidYears: 1,
  },
  balanced: {
    bonusShareDelta: 0.05,
    voidYearChance: 0.15,
    maxVoidYears: 1,
  },
  flush: {
    bonusShareDelta: -0.10,
    voidYearChance: 0,
    maxVoidYears: 0,
  },
};

function clampRatio(value: number): number {
  return Math.max(0, Math.min(0.95, value));
}

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
    qualityTier: QualityTier;
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

export function rollVeteranContract(
  rng: SeededRng,
  args: {
    playerId: string;
    teamId: string;
    bucket: NeutralBucket;
    quality: number;
    qualityTier: QualityTier;
    age: number;
    signedYear: number;
    archetype: CapArchetype;
  },
  multiplierFn: SalaryMultiplierFn,
): RolledContractBundle {
  const modifier = ARCHETYPE_MODIFIER[args.archetype];
  const prior = getContractStructurePrior(
    bucketToContractPosition(args.bucket),
    qualityTierToContractTier(args.qualityTier),
  );
  const mult = multiplierFn(args.bucket, args.quality);
  const excess = Math.max(0, args.quality - 50);
  const baseSalary = SALARY_FLOOR + excess * SALARY_PER_QUALITY_POINT * mult;
  const jitter = 0.9 + rng.next() * 0.2;
  const annualBase = Math.max(SALARY_FLOOR, Math.round(baseSalary * jitter));

  // Sample length from the position × tier band. The p10/p90 window
  // captures most of the real distribution and keeps CB contracts
  // noticeably shorter than QB contracts at the same tier.
  const lenMin = Math.max(1, Math.round(prior.lengthP10));
  const lenMax = Math.max(lenMin, Math.round(prior.lengthP90));
  let realYears = rng.int(lenMin, lenMax);
  if (args.age >= 32) realYears = Math.min(realYears, 2);

  const totalValue = annualBase * realYears;

  // Signing-bonus share: position × tier baseline jittered around the
  // mean, then nudged by archetype. Flush teams push cash flat, cap-
  // hell teams push bonus-heavy to defer the hit.
  const bonusSpread = Math.max(
    0.05,
    (prior.bonusShareP90 - prior.bonusShareP10) / 2,
  );
  const bonusSampled = prior.bonusShareMean +
    (rng.next() * 2 - 1) * bonusSpread;
  const bonusRatio = clampRatio(bonusSampled + modifier.bonusShareDelta);
  const signingBonus = Math.round(totalValue * bonusRatio);
  const remainingBase = totalValue - signingBonus;

  // Void years are an archetype lever only — the league-wide per-
  // position rate is effectively zero in the data (see
  // void_year_usage_rate_by_position in contract-structure.json).
  let voidYears = 0;
  if (
    modifier.maxVoidYears > 0 && realYears >= 2 &&
    rng.next() < modifier.voidYearChance
  ) {
    voidYears = rng.int(1, modifier.maxVoidYears);
  }
  const totalYears = realYears + voidYears;

  // Guaranteed-year count derives from the position × tier guarantee
  // share — IOL top-10 deals get the most guaranteed seasons, CB top-
  // 10s the fewest, matching the research bands.
  const guarSpread = Math.max(
    0.05,
    (prior.guaranteeShareP90 - prior.guaranteeShareP10) / 2,
  );
  const guarRatio = clampRatio(
    prior.guaranteeShareMean + (rng.next() * 2 - 1) * guarSpread,
  );
  // Probabilistic rounding preserves the sampled share's expectation
  // across a roster — deterministic `round` discards the fractional
  // part and collapses neighbouring priors (IOL 0.53 vs OT 0.46) to
  // the same integer for typical realYears, erasing the position
  // signal the data encodes.
  const guarYearsRaw = guarRatio * realYears;
  const guarFloor = Math.floor(guarYearsRaw);
  const guarFrac = guarYearsRaw - guarFloor;
  const guaranteedYears = Math.max(
    1,
    guarFloor + (rng.next() < guarFrac ? 1 : 0),
  );

  // Per-year base follows the cap-hit shape of real deals at this
  // position × tier. Top-10 QB deals are back-loaded (Y1 ~15%, Y5
  // ~34%); top-10 RB deals are front-loaded. Flat fallback is used
  // only when the source shape is degenerate.
  const shape = prior.capHitShape.slice(0, realYears);
  const shapeSum = shape.reduce((s, v) => s + v, 0);
  const yearBases: number[] = [];
  if (shapeSum > 0) {
    for (let i = 0; i < realYears; i++) {
      yearBases.push(
        Math.max(1, Math.floor(remainingBase * (shape[i] / shapeSum))),
      );
    }
  } else {
    const perYear = Math.max(1, Math.floor(remainingBase / realYears));
    for (let i = 0; i < realYears; i++) yearBases.push(perYear);
  }
  const yearBaseSum = yearBases.reduce((s, v) => s + v, 0);
  yearBases[realYears - 1] += remainingBase - yearBaseSum;
  if (yearBases[realYears - 1] < 1) yearBases[realYears - 1] = 1;

  const years: GeneratedContractYear[] = [];
  for (let i = 0; i < realYears; i++) {
    const guaranteeType: ContractGuaranteeType = i < guaranteedYears
      ? "full"
      : "none";
    years.push({
      leagueYear: args.signedYear + i,
      base: yearBases[i],
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
 * League-wide elite-tier caps, from the scale contract in
 * `docs/product/north-star/player-attributes.md`:
 *
 * - 85+ (elite) are "extraordinarily rare — 5-10 across the entire
 *   league". Implemented as a team-scaled budget: ~10 elites per 32-team
 *   league, rounded, minimum 1 so small test leagues still get one.
 * - 95+ (generational) "may not exist in any given season" and are
 *   "one per decade per position". Implemented as at most one per
 *   neutral bucket per league.
 *
 * Independent rolls can produce more than the spec allows — this pass
 * sorts by signature overall and pushes the excess just below the
 * threshold (elite capped to 84, generational capped to 94) by
 * subtracting a flat delta from every signature attribute. Bucket
 * classification is unaffected because all signature attributes move
 * together and by the same amount.
 */
export const ELITE_OVERALL_THRESHOLD = 85;
export const GENERATIONAL_OVERALL_THRESHOLD = 95;
export const ELITES_PER_32_TEAMS = 10;

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
}

function classifyForCap(
  entries: ReadonlyArray<{
    player: { heightInches: number; weightPounds: number };
    attributes: PlayerAttributes;
  }>,
): ClassifiedEntry[] {
  const classified: ClassifiedEntry[] = entries.map((e) => {
    const bucket = neutralBucket({
      attributes: e.attributes,
      heightInches: e.player.heightInches,
      weightPounds: e.player.weightPounds,
    });
    return {
      attributes: e.attributes,
      bucket,
      overall: signatureOverall(e.attributes, bucket),
    };
  });
  return classified;
}

export function applyLeagueEliteCaps(
  entries: ReadonlyArray<{
    player: { heightInches: number; weightPounds: number };
    attributes: PlayerAttributes;
  }>,
  teamCount: number,
): void {
  if (entries.length === 0 || teamCount === 0) return;

  const eliteBudget = Math.max(
    1,
    Math.round((ELITES_PER_32_TEAMS * teamCount) / 32),
  );

  // Capping a player's signature attrs can shift his neutral-bucket
  // classification (non-signature attrs become relatively higher). We
  // reclassify and re-cap until the league settles under both budgets,
  // up to a generous iteration cap. This converges quickly in practice
  // because each iteration can only reduce a player's signature
  // overall, never raise it.
  const MAX_SWEEPS = 8;
  for (let sweep = 0; sweep < MAX_SWEEPS; sweep++) {
    const classified = classifyForCap(entries);

    // Generational (95+) cap: at most one per bucket per league.
    const byBucket = new Map<NeutralBucket, ClassifiedEntry[]>();
    for (const c of classified) {
      const list = byBucket.get(c.bucket) ?? [];
      list.push(c);
      byBucket.set(c.bucket, list);
    }
    let changed = false;
    for (const [, list] of byBucket) {
      const generationals = list
        .filter((c) => c.overall >= GENERATIONAL_OVERALL_THRESHOLD)
        .sort((a, b) => b.overall - a.overall);
      for (let i = 1; i < generationals.length; i++) {
        pushBelowOverall(
          generationals[i].attributes,
          generationals[i].bucket,
          GENERATIONAL_OVERALL_THRESHOLD - 1,
        );
        changed = true;
      }
    }

    // Elite (85+) cap, league-wide.
    const elites = classified
      .filter((c) => c.overall >= ELITE_OVERALL_THRESHOLD)
      .sort((a, b) => b.overall - a.overall);
    for (let i = eliteBudget; i < elites.length; i++) {
      pushBelowOverall(
        elites[i].attributes,
        elites[i].bucket,
        ELITE_OVERALL_THRESHOLD - 1,
      );
      changed = true;
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
    const quality = rollQuality(
      rng,
      qualityTierForIndex(args.indexInBucket, args.bucketCount),
    );
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
      const rosteredEntries: typeof players = [];

      // input.rosterSize is the league's roster cap (config), but the actual
      // generated count is fixed by ROSTER_BUCKET_COMPOSITION — the data-
      // calibrated 48-man composition. A larger cap leaves open slots; a
      // zero cap (e.g. an empty league at creation time) skips entirely.
      const rosteredCount = input.rosterSize > 0
        ? ROSTER_BUCKET_SLOTS.length
        : 0;
      for (const teamId of input.teamIds) {
        const bucketIndex = new Map<NeutralBucket, number>();
        const bucketTotal = new Map<NeutralBucket, number>();
        for (const { bucket, count } of ROSTER_BUCKET_COMPOSITION) {
          bucketTotal.set(bucket, count);
        }
        for (let i = 0; i < rosteredCount; i++) {
          const bucket = ROSTER_BUCKET_SLOTS[i];
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
          rosteredEntries.push(entry);
        }
      }

      // Apply the league-wide elite-tier budget across the rostered
      // pool. Free agents and prospects live outside the "X per
      // league" budgets — FAs are index-biased toward depth, and the
      // draft class is a one-year wave rather than the steady league
      // population the spec quantifies.
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
          const tier = qualityTierForIndex(indexInBucket, bucketCount);
          const quality = rollQuality(rng, tier);
          const age = rollAge(rng, "rostered", bucket);
          return rollContract(
            rng,
            {
              playerId: p.id,
              teamId,
              bucket,
              quality,
              qualityTier: tier,
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
