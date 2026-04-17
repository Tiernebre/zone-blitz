import {
  createRng,
  mulberry32,
  type NeutralBucket,
  neutralBucket,
  type SchemeFingerprint,
  type SeededRng,
} from "@zone-blitz/shared";
import { CALIBRATION_SEED } from "./calibration-seed.ts";
import type { CoachingMods, PlayerRuntime } from "../resolve-play.ts";
import type { SimTeam } from "../simulate-game.ts";
import { createPlayersGenerator } from "../../players/players-generator.ts";
import type { PlayersGenerator } from "../../players/players.generator.interface.ts";
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

// Calibration fixtures use a larger-than-NFL team count to shrink
// between-seed sampling noise on league-wide metrics. 64 teams halves
// the standard error of the mean on metrics like YPC so the seeded
// fixtures can all land inside the NFL bands (±0.07 tolerances)
// without asking the engine to be luckier than statistics allows.
const DEFAULT_TEAM_COUNT = 64;
const ROSTER_SIZE = 53;

export interface GenerateCalibrationLeagueOptions {
  seed?: number;
  teamCount?: number;
  /**
   * Player generator used to produce rostered players. Defaults to the
   * production `createPlayersGenerator` seeded from the calibration
   * seed so calibration tracks whatever distribution production
   * currently ships — no duplicated quality/attribute math.
   */
  playersGenerator?: PlayersGenerator;
}

// Depth-chart split per bucket. Independent of the generator's quality
// tiers — these numbers answer "how many of each bucket start on
// Sunday", not "how many of each bucket are elite". The generator
// still owns which rostered players get star/starter/depth means.
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

function generateFingerprint(
  rng: SeededRng,
  teamIndex: number,
): SchemeFingerprint {
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

function generateCoachingMods(rng: SeededRng): CoachingMods {
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

export function generateCalibrationLeague(
  options: GenerateCalibrationLeagueOptions = {},
): CalibrationLeague {
  const seed = options.seed ?? CALIBRATION_SEED;
  const teamCount = options.teamCount ?? DEFAULT_TEAM_COUNT;
  // Dedicated rng for fingerprints + coaching mods. Kept separate from
  // the player-generator stream so a change to player generation
  // doesn't shift every downstream fingerprint/mod roll — if production
  // swaps a roll in, calibration's scheme mix stays stable and only
  // the player distribution shifts in the harness output.
  const schemeRng = createRng(mulberry32(seed ^ 0xfacefeed));

  const playersGenerator = options.playersGenerator ??
    createPlayersGenerator({ random: mulberry32(seed) });

  const teamIds = Array.from(
    { length: teamCount },
    (_, i) => `cal-team-${i}`,
  );
  const generated = playersGenerator.generate({
    leagueId: "cal-league",
    seasonId: "cal-season",
    teamIds,
    rosterSize: ROSTER_SIZE,
  });

  const rosteredByTeam = new Map<
    string,
    ReadonlyArray<typeof generated.players[number]>
  >();
  for (const teamId of teamIds) {
    rosteredByTeam.set(
      teamId,
      generated.players.filter((p) => p.player.teamId === teamId),
    );
  }

  return {
    calibrationSeed: seed,
    teams: teamIds.map((teamId, i) => {
      const roster = rosteredByTeam.get(teamId) ?? [];
      const bucketSeen = new Map<NeutralBucket, number>();
      const starters: PlayerRuntime[] = [];
      const bench: PlayerRuntime[] = [];

      for (const gp of roster) {
        const bucket = neutralBucket({
          attributes: gp.attributes,
          heightInches: gp.player.heightInches,
          weightPounds: gp.player.weightPounds,
        });
        const indexInBucket = bucketSeen.get(bucket) ?? 0;
        bucketSeen.set(bucket, indexInBucket + 1);

        const runtime: PlayerRuntime = {
          playerId: `cal-t${i}-${bucket.toLowerCase()}-${indexInBucket}`,
          neutralBucket: bucket,
          attributes: gp.attributes,
        };
        if (indexInBucket < STARTER_SLOTS[bucket]) starters.push(runtime);
        else bench.push(runtime);
      }

      return {
        teamId,
        starters,
        bench,
        fingerprint: generateFingerprint(schemeRng, i),
        coachingMods: generateCoachingMods(schemeRng),
      };
    }),
  };
}
