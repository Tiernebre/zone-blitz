import {
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributes,
  type SchemeFingerprint,
} from "@zone-blitz/shared";
import type { GameResult } from "./events.ts";
import type { CoachingMods, PlayerRuntime } from "./resolve-play.ts";
import { createSeededRng, deriveGameSeed } from "./rng.ts";
import type { SeededRng } from "./rng.ts";
import { type SimTeam, simulateGame } from "./simulate-game.ts";
import type { SimLogger } from "./simulation-logger.ts";
import { noopLogger } from "./simulation-logger.ts";

export interface SeasonInput {
  leagueSeed: number;
  teamCount?: number;
  gamesPerTeam?: number;
  log?: SimLogger;
}

export interface SeasonResult {
  results: GameResult[];
  elapsedMs: number;
}

type AttrBoosts = Partial<Record<string, [number, number]>>;

const POSITION_ATTR_PROFILES: Record<string, AttrBoosts> = {
  QB: {
    throwPower: [65, 90],
    throwAccuracyShort: [65, 90],
    throwAccuracyMid: [60, 85],
    throwAccuracyDeep: [55, 80],
  },
  RB: {
    speed: [60, 85],
    agility: [60, 85],
    acceleration: [60, 85],
    carrying: [65, 85],
  },
  WR: {
    speed: [65, 90],
    routeRunning: [60, 85],
    catching: [60, 88],
    acceleration: [60, 85],
  },
  TE: {
    catching: [55, 78],
    runBlocking: [55, 75],
    routeRunning: [50, 72],
    strength: [60, 80],
  },
  OT: {
    passBlocking: [58, 80],
    runBlocking: [58, 80],
    strength: [62, 84],
    agility: [40, 60],
  },
  IOL: {
    passBlocking: [58, 80],
    runBlocking: [60, 82],
    strength: [64, 86],
    agility: [35, 55],
  },
  EDGE: {
    passRushing: [65, 88],
    acceleration: [60, 82],
    speed: [56, 78],
    strength: [58, 80],
  },
  IDL: {
    passRushing: [58, 80],
    blockShedding: [62, 84],
    strength: [66, 88],
    runDefense: [60, 82],
  },
  LB: {
    tackling: [60, 82],
    runDefense: [58, 80],
    zoneCoverage: [46, 68],
    speed: [50, 72],
  },
  CB: {
    manCoverage: [62, 86],
    zoneCoverage: [60, 84],
    speed: [66, 90],
    agility: [60, 82],
  },
  S: {
    zoneCoverage: [60, 82],
    manCoverage: [52, 75],
    tackling: [56, 76],
    speed: [60, 82],
  },
};

function generateAttributes(
  rng: SeededRng,
  bucket: string,
): PlayerAttributes {
  const attrs: Record<string, number> = {};
  const profile = POSITION_ATTR_PROFILES[bucket] ?? {};

  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    const boost = profile[key];
    if (boost) {
      attrs[key] = rng.int(boost[0], boost[1]);
    } else {
      attrs[key] = rng.int(30, 65);
    }
    attrs[`${key}Potential`] = rng.int(attrs[key], 99);
  }
  return attrs as unknown as PlayerAttributes;
}

function generateFingerprint(rng: SeededRng): SchemeFingerprint {
  return {
    offense: {
      runPassLean: rng.int(30, 70),
      tempo: rng.int(30, 70),
      personnelWeight: rng.int(30, 70),
      formationUnderCenterShotgun: rng.int(30, 70),
      preSnapMotionRate: rng.int(20, 60),
      passingStyle: rng.int(30, 70),
      passingDepth: rng.int(30, 70),
      runGameBlocking: rng.int(30, 70),
      rpoIntegration: rng.int(20, 60),
    },
    defense: {
      frontOddEven: rng.int(30, 70),
      gapResponsibility: rng.int(30, 70),
      subPackageLean: rng.int(30, 70),
      coverageManZone: rng.int(30, 70),
      coverageShell: rng.int(30, 70),
      cornerPressOff: rng.int(30, 70),
      pressureRate: rng.int(30, 52),
      disguiseRate: rng.int(20, 60),
    },
    overrides: {},
  };
}

function makePlayer(
  id: string,
  bucket: PlayerRuntime["neutralBucket"],
  rng: SeededRng,
): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: bucket,
    attributes: generateAttributes(rng, bucket),
  };
}

const STARTER_TEMPLATE: {
  bucket: PlayerRuntime["neutralBucket"];
  count: number;
}[] = [
  { bucket: "QB", count: 1 },
  { bucket: "RB", count: 1 },
  { bucket: "WR", count: 2 },
  { bucket: "TE", count: 1 },
  { bucket: "OT", count: 2 },
  { bucket: "IOL", count: 3 },
  { bucket: "EDGE", count: 2 },
  { bucket: "IDL", count: 2 },
  { bucket: "LB", count: 2 },
  { bucket: "CB", count: 2 },
  { bucket: "S", count: 2 },
  { bucket: "K", count: 1 },
  { bucket: "K", count: 1 },
];

const BENCH_TEMPLATE: {
  bucket: PlayerRuntime["neutralBucket"];
  count: number;
}[] = [
  { bucket: "QB", count: 1 },
  { bucket: "RB", count: 1 },
  { bucket: "WR", count: 2 },
  { bucket: "TE", count: 1 },
  { bucket: "OT", count: 1 },
  { bucket: "IOL", count: 1 },
  { bucket: "EDGE", count: 1 },
  { bucket: "IDL", count: 1 },
  { bucket: "LB", count: 1 },
  { bucket: "CB", count: 1 },
  { bucket: "S", count: 1 },
];

function generateTeam(teamId: string, rng: SeededRng): SimTeam {
  let idx = 0;
  const starters: PlayerRuntime[] = [];
  for (const { bucket, count } of STARTER_TEMPLATE) {
    for (let i = 0; i < count; i++) {
      starters.push(makePlayer(`${teamId}-s${idx++}`, bucket, rng));
    }
  }

  const bench: PlayerRuntime[] = [];
  for (const { bucket, count } of BENCH_TEMPLATE) {
    for (let i = 0; i < count; i++) {
      bench.push(makePlayer(`${teamId}-b${idx++}`, bucket, rng));
    }
  }

  return {
    teamId,
    starters,
    bench,
    fingerprint: generateFingerprint(rng),
    coachingMods: {
      schemeFitBonus: rng.int(-3, 3),
      situationalBonus: rng.int(-2, 2),
      aggressiveness: rng.int(30, 70),
      penaltyDiscipline: 1,
    } as CoachingMods,
  };
}

function generateSchedule(
  teamCount: number,
  gamesPerTeam: number,
): { home: number; away: number }[] {
  const games: { home: number; away: number }[] = [];
  const rotating = Array.from({ length: teamCount - 1 }, (_, i) => i + 1);

  for (let round = 0; round < gamesPerTeam; round++) {
    const lineup = [0, ...rotating];
    const half = teamCount / 2;
    for (let i = 0; i < half; i++) {
      const a = lineup[i];
      const b = lineup[teamCount - 1 - i];
      games.push(
        round % 2 === 0 ? { home: a, away: b } : { home: b, away: a },
      );
    }
    const last = rotating.pop()!;
    rotating.unshift(last);
  }

  return games;
}

export function simulateSeason(input: SeasonInput): SeasonResult {
  const { leagueSeed, teamCount = 32, gamesPerTeam = 17 } = input;
  const log = (input.log ?? noopLogger).child({ module: "simulate-season" });
  const setupRng = createSeededRng(leagueSeed);

  const teams: SimTeam[] = [];
  for (let i = 0; i < teamCount; i++) {
    teams.push(generateTeam(`team-${i}`, setupRng));
  }

  const schedule = generateSchedule(teamCount, gamesPerTeam);
  const gamesPerWeek = teamCount / 2;

  log.info(
    { leagueSeed, teamCount, gamesPerTeam, totalGames: schedule.length },
    "season simulation started",
  );

  const start = performance.now();
  const results: GameResult[] = [];

  for (let i = 0; i < schedule.length; i++) {
    const { home, away } = schedule[i];
    const gameId = `season-game-${i}`;
    const gameSeed = deriveGameSeed(leagueSeed, gameId);
    const result = simulateGame({
      home: teams[home],
      away: teams[away],
      seed: gameSeed,
      gameId,
      log: input.log,
    });
    results.push(result);

    // Log week completion at the end of each week
    if ((i + 1) % gamesPerWeek === 0 || i === schedule.length - 1) {
      const week = Math.floor(i / gamesPerWeek) + 1;
      const weekGames = Math.min(
        gamesPerWeek,
        (i + 1) - (week - 1) * gamesPerWeek,
      );
      log.debug(
        { week, gamesInWeek: weekGames, totalCompleted: i + 1 },
        "week simulated",
      );
    }
  }

  const elapsedMs = performance.now() - start;

  log.info(
    {
      leagueSeed,
      totalGames: results.length,
      elapsedMs: Math.round(elapsedMs),
    },
    "season simulation ended",
  );

  return { results, elapsedMs };
}
