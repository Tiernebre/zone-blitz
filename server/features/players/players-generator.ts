import {
  NEUTRAL_BUCKETS,
  type NeutralBucket,
  neutralBucket,
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributeKey,
  type PlayerAttributes,
  positionalSalaryMultiplier,
} from "@zone-blitz/shared";
import {
  createNameGenerator,
  type NameGenerator,
} from "../../shared/name-generator.ts";
import { DEFAULT_COLLEGES } from "../colleges/default-colleges.ts";
import { DEFAULT_CITIES } from "../cities/default-cities.ts";
import type {
  ContractGeneratorInput,
  GeneratedContract,
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
// lead-blocking fullbacks classify as RB under the neutral lens (ADR 0006).
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

const VETERAN_AGE_MIN = 21;
const VETERAN_AGE_MAX = 36;
const PROSPECT_AGE_MIN = 20;
const PROSPECT_AGE_MAX = 23;

interface Rng {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  gaussian(mean: number, stddev: number, min: number, max: number): number;
}

function createRng(random: () => number): Rng {
  return {
    next: random,
    int(min, max) {
      return Math.floor(random() * (max - min + 1)) + min;
    },
    pick<T>(arr: readonly T[]): T {
      return arr[Math.floor(random() * arr.length)];
    },
    gaussian(mean, stddev, min, max) {
      // Box-Muller, clamped. Two uniforms in, one normal out per call; the
      // RNG stream advances deterministically per attribute roll.
      const u1 = Math.max(random(), 1e-9);
      const u2 = random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const value = Math.round(mean + z * stddev);
      return Math.max(min, Math.min(max, value));
    },
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Rough overall score in [30, 95] per tier. */
function rollQuality(rng: Rng, tier: "star" | "starter" | "depth"): number {
  const mean = tier === "star" ? 82 : tier === "starter" ? 70 : 58;
  const stddev = tier === "star" ? 5 : tier === "starter" ? 6 : 7;
  return rng.gaussian(mean, stddev, 30, 95);
}

function qualityTierForIndex(
  indexInBucket: number,
  bucketCount: number,
): "star" | "starter" | "depth" {
  if (bucketCount <= 1) return "starter";
  if (indexInBucket === 0) return "star";
  const starterCount = Math.max(1, Math.floor(bucketCount / 2));
  if (indexInBucket <= starterCount) return "starter";
  return "depth";
}

function rollAttributesFor(
  rng: Rng,
  bucket: NeutralBucket,
  quality: number,
): PlayerAttributes {
  const profile = BUCKET_PROFILES[bucket];
  const signatureSet = new Set<PlayerAttributeKey>(profile.signature);
  const deEmphasizedSet = new Set<PlayerAttributeKey>(profile.deEmphasized);

  const attrs: Record<string, number> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    let mean: number;
    if (signatureSet.has(key)) {
      mean = quality + 10;
    } else if (deEmphasizedSet.has(key)) {
      mean = Math.max(25, Math.round(quality * 0.55));
    } else {
      mean = Math.round(quality * 0.85);
    }
    attrs[key] = rng.gaussian(mean, 5, 25, 99);
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
  const MAX_ITERS = 20;
  for (let iter = 0; iter < MAX_ITERS; iter++) {
    const classified = neutralBucket({
      attributes,
      heightInches,
      weightPounds,
    });
    if (classified === bucket) return;
    for (const key of profile.signature) {
      rec[key] = Math.min(99, rec[key] + 2);
    }
  }
}

function rollPotentials(
  rng: Rng,
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

function rollHeightWeight(rng: Rng, bucket: NeutralBucket): {
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
  rng: Rng,
  status: "rostered" | "free-agent" | "prospect",
): number {
  if (status === "prospect") {
    return rng.int(PROSPECT_AGE_MIN, PROSPECT_AGE_MAX);
  }
  // Triangular-ish around the middle of the playing-age band.
  const raw = (rng.next() + rng.next()) / 2;
  const span = VETERAN_AGE_MAX - VETERAN_AGE_MIN;
  return VETERAN_AGE_MIN + Math.round(raw * span);
}

function birthDateForAge(age: number, currentYear: number, rng: Rng): string {
  const year = currentYear - age;
  const month = rng.int(1, 12);
  const day = rng.int(1, 28);
  return `${year}-${String(month).padStart(2, "0")}-${
    String(day).padStart(2, "0")
  }`;
}

function pickCollege(rng: Rng): string {
  return rng.pick(DEFAULT_COLLEGES).shortName;
}

function pickHometown(rng: Rng): string {
  const city = rng.pick(DEFAULT_CITIES);
  return `${city.name}, ${city.stateCode}`;
}

function rollOrigin(
  rng: Rng,
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

function rollContract(
  rng: Rng,
  args: {
    playerId: string;
    teamId: string;
    bucket: NeutralBucket;
    quality: number;
    age: number;
  },
  multiplierFn: SalaryMultiplierFn,
): GeneratedContract {
  const isRookie = args.age <= ROOKIE_SCALE_AGE_THRESHOLD;
  const mult = isRookie ? 1.0 : multiplierFn(args.bucket, args.quality);
  const excess = Math.max(0, args.quality - 50);
  const base = SALARY_FLOOR + excess * SALARY_PER_QUALITY_POINT * mult;
  const jitter = 0.9 + rng.next() * 0.2;
  const annualSalary = Math.max(SALARY_FLOOR, Math.round(base * jitter));
  let totalYears: number;
  if (args.age >= 32) totalYears = rng.int(1, 2);
  else if (args.quality >= 80) totalYears = rng.int(3, 5);
  else if (args.quality >= 65) totalYears = rng.int(2, 4);
  else totalYears = rng.int(1, 3);
  const totalSalary = annualSalary * totalYears;
  const guaranteedPct = args.quality >= 80
    ? 0.5 + rng.next() * 0.2
    : args.quality >= 65
    ? 0.2 + rng.next() * 0.2
    : 0.05 + rng.next() * 0.1;
  const guaranteedMoney = Math.round(totalSalary * guaranteedPct);
  const signingBonus = Math.round(guaranteedMoney * (0.3 + rng.next() * 0.3));
  return {
    playerId: args.playerId,
    teamId: args.teamId,
    totalYears,
    currentYear: 1,
    totalSalary,
    annualSalary,
    guaranteedMoney,
    signingBonus,
  };
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
    const age = rollAge(rng, args.statusKind);
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
          players.push(
            buildPlayer({
              leagueId: input.leagueId,
              teamId,
              status: "active",
              bucket,
              indexInBucket,
              bucketCount: bucketTotal.get(bucket) ?? 1,
              draftingTeamId: teamId,
              statusKind: "rostered",
            }),
          );
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

    generateContracts(input: ContractGeneratorInput): GeneratedContract[] {
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

      const contracts: GeneratedContract[] = [];
      for (const [teamId, teamPlayers] of byTeam) {
        // The contract callsite only has ids + teamId, so we synthesize a
        // plausible bucket/quality/age per seat so salaries vary across the
        // roster. The per-team annual total is then scaled down uniformly if
        // it would exceed the cap.
        const rawContracts = teamPlayers.map((p, idx) => {
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
          const age = rollAge(rng, "rostered");
          return rollContract(rng, {
            playerId: p.id,
            teamId,
            bucket,
            quality,
            age,
          }, salaryMultiplier);
        });
        const teamAnnualTotal = rawContracts.reduce(
          (s, c) => s + c.annualSalary,
          0,
        );
        const scale = teamAnnualTotal > input.salaryCap
          ? input.salaryCap / teamAnnualTotal
          : 1;
        for (const c of rawContracts) {
          // Scale down without re-applying the per-player floor — the floor
          // already applied during the raw roll, and clamping again after
          // scaling would push the team total back over the cap.
          const annualSalary = Math.max(
            1,
            Math.floor(c.annualSalary * scale),
          );
          contracts.push({
            ...c,
            annualSalary,
            totalSalary: annualSalary * c.totalYears,
            guaranteedMoney: Math.round(c.guaranteedMoney * scale),
            signingBonus: Math.round(c.signingBonus * scale),
          });
        }
      }
      return contracts;
    },
  };
}
