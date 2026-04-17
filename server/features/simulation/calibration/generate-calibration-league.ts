import {
  mulberry32,
  type NeutralBucket,
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributeKey,
  type PlayerAttributes,
  type SchemeFingerprint,
} from "@zone-blitz/shared";
import { CALIBRATION_SEED } from "./calibration-seed.ts";
import type { CoachingMods, PlayerRuntime } from "../resolve-play.ts";
import type { SimTeam } from "../simulate-game.ts";
import {
  BUCKET_PROFILES,
  ROSTER_BUCKET_COMPOSITION,
} from "../../players/players-generator.ts";
import {
  DEFENSIVE_ARCHETYPES,
  defensiveVectorFromArchetype,
  OFFENSIVE_ARCHETYPES,
  offensiveVectorFromArchetype,
} from "../../coaches/coach-tendency-archetypes.ts";

export interface CalibrationLeague {
  calibrationSeed: number;
  teams: SimTeam[];
}

const TEAM_COUNT = 32;

const STARTER_SLOTS: Record<NeutralBucket, number> = {
  QB: 1,
  RB: 1,
  WR: 3,
  TE: 1,
  OT: 2,
  IOL: 3,
  EDGE: 2,
  IDL: 2,
  LB: 3,
  CB: 2,
  S: 2,
  K: 1,
  P: 1,
  LS: 1,
};

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
      const u1 = Math.max(random(), 1e-9);
      const u2 = random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const value = Math.round(mean + z * stddev);
      return Math.max(min, Math.min(max, value));
    },
  };
}

function rollAttributes(
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

function rollQuality(rng: Rng, tier: "star" | "starter" | "depth"): number {
  const mean = tier === "star" ? 82 : tier === "starter" ? 70 : 58;
  const stddev = tier === "star" ? 5 : tier === "starter" ? 6 : 7;
  return rng.gaussian(mean, stddev, 30, 95);
}

function generatePlayer(
  rng: Rng,
  bucket: NeutralBucket,
  teamIndex: number,
  playerIndex: number,
  tier: "star" | "starter" | "depth",
): PlayerRuntime {
  const quality = rollQuality(rng, tier);
  const attributes = rollAttributes(rng, bucket, quality);
  return {
    playerId: `cal-t${teamIndex}-${bucket.toLowerCase()}-${playerIndex}`,
    neutralBucket: bucket,
    attributes,
  };
}

function generateTeamRoster(
  rng: Rng,
  teamIndex: number,
): { starters: PlayerRuntime[]; bench: PlayerRuntime[] } {
  const starters: PlayerRuntime[] = [];
  const bench: PlayerRuntime[] = [];

  let playerCounter = 0;

  for (const { bucket, count } of ROSTER_BUCKET_COMPOSITION) {
    const starterCount = STARTER_SLOTS[bucket];
    for (let i = 0; i < count; i++) {
      const tier = i === 0 ? "star" : i < starterCount ? "starter" : "depth";
      const player = generatePlayer(
        rng,
        bucket,
        teamIndex,
        playerCounter,
        tier,
      );
      playerCounter++;

      if (i < starterCount) {
        starters.push(player);
      } else {
        bench.push(player);
      }
    }
  }

  return { starters, bench };
}

function generateFingerprint(rng: Rng, teamIndex: number): SchemeFingerprint {
  const offArchetype =
    OFFENSIVE_ARCHETYPES[teamIndex % OFFENSIVE_ARCHETYPES.length];
  const defArchetype =
    DEFENSIVE_ARCHETYPES[teamIndex % DEFENSIVE_ARCHETYPES.length];

  const offSeed = `cal-team-${teamIndex}-oc`;
  const defSeed = `cal-team-${teamIndex}-dc`;

  const offense = offensiveVectorFromArchetype(offArchetype, offSeed);
  // Override runPassLean with a normally-distributed sample so the
  // calibration league mirrors the NFL's roughly-normal play-calling
  // tendency rather than the bimodal cluster the five archetypes
  // produce when cycled over 32 teams. See issue #367.
  offense.runPassLean = rng.gaussian(57, 7, 35, 78);

  return {
    offense,
    defense: defensiveVectorFromArchetype(defArchetype, defSeed),
    overrides: {},
  };
}

function generateCoachingMods(rng: Rng): CoachingMods {
  // Calibration draws three raw mod values from the main rng — same
  // number and order of `rng.int` calls as the pre-ratings baseline —
  // then synthesizes the hidden ratings that would have produced them.
  // Keeping the rng consumption pattern unchanged preserves the NFL
  // bands that were validated against the original stream. Production
  // coaches generate ratings directly (see `coaches-generator.ts`) and
  // call `coachRatingsToMods` on the way in.
  const schemeFitBonus = rng.int(0, 5);
  const situationalBonus = rng.int(0, 3);
  const aggressiveness = rng.int(30, 70);
  return {
    schemeFitBonus,
    situationalBonus,
    aggressiveness,
    penaltyDiscipline: 1,
  };
}

export function generateCalibrationLeague(): CalibrationLeague {
  const random = mulberry32(CALIBRATION_SEED);
  const rng = createRng(random);

  const teams: SimTeam[] = [];
  for (let i = 0; i < TEAM_COUNT; i++) {
    const { starters, bench } = generateTeamRoster(rng, i);
    const fingerprint = generateFingerprint(rng, i);
    const coachingMods = generateCoachingMods(rng);

    teams.push({
      teamId: `cal-team-${i}`,
      starters,
      bench,
      fingerprint,
      coachingMods,
    });
  }

  return {
    calibrationSeed: CALIBRATION_SEED,
    teams,
  };
}
