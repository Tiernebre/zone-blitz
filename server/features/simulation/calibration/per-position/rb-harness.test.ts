import { assertEquals, assertStringIncludes } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { formatRbCalibrationReport, runRbCalibration } from "./rb-harness.ts";
import type { GameResult, PlayEvent } from "../../events.ts";
import type { SimTeam } from "../../simulate-game.ts";
import type { PlayerRuntime } from "../../resolve-play.ts";
import type { CalibrationLeague } from "../generate-calibration-league.ts";

function attrs(overrides: Partial<PlayerAttributes> = {}): PlayerAttributes {
  const base: Record<string, number> = {};
  const keys = [
    "speed",
    "acceleration",
    "agility",
    "strength",
    "jumping",
    "stamina",
    "durability",
    "armStrength",
    "accuracyShort",
    "accuracyMedium",
    "accuracyDeep",
    "accuracyOnTheRun",
    "touch",
    "release",
    "ballCarrying",
    "elusiveness",
    "routeRunning",
    "catching",
    "contestedCatching",
    "runAfterCatch",
    "passBlocking",
    "runBlocking",
    "blockShedding",
    "tackling",
    "manCoverage",
    "zoneCoverage",
    "passRushing",
    "runDefense",
    "kickingPower",
    "kickingAccuracy",
    "puntingPower",
    "puntingAccuracy",
    "snapAccuracy",
    "footballIq",
    "decisionMaking",
    "anticipation",
    "composure",
    "clutch",
    "consistency",
    "workEthic",
    "coachability",
    "leadership",
    "greed",
    "loyalty",
    "ambition",
    "vanity",
    "schemeAttachment",
    "mediaSensitivity",
  ];
  for (const k of keys) {
    base[k] = 50;
    base[`${k}Potential`] = 50;
  }
  return { ...(base as unknown as PlayerAttributes), ...overrides };
}

function rbRuntime(id: string, overall: number): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: "RB",
    attributes: attrs({
      ballCarrying: overall,
      elusiveness: overall,
      acceleration: overall,
      speed: overall,
    }),
  };
}

function team(teamId: string, starterRb: PlayerRuntime): SimTeam {
  return {
    teamId,
    starters: [starterRb],
    bench: [],
    fingerprint: { offense: null, defense: null, overrides: {} },
    coachingMods: {
      schemeFitBonus: 0,
      situationalBonus: 0,
      aggressiveness: 50,
      penaltyDiscipline: 1,
    },
  };
}

function bandJson(): string {
  const band = (ypc: number) => ({
    n: 20,
    metrics: {
      yards_per_carry: { n: 20, mean: ypc, sd: 0.4 },
      rush_td_rate: { n: 20, mean: 0.035, sd: 0.015 },
      yards_per_game: { n: 20, mean: ypc * 13, sd: 15 },
      fumble_rate: { n: 20, mean: 0.004, sd: 0.003 },
    },
  });
  return JSON.stringify({
    position: "RB",
    seasons: [2020, 2021, 2022, 2023, 2024],
    ranking_stat: "epa_per_play",
    bands: {
      elite: band(5.4),
      good: band(4.7),
      average: band(4.3),
      weak: band(4.0),
      replacement: band(3.6),
    },
  });
}

function makeGame(
  gameId: string,
  homeTeamId: string,
  awayTeamId: string,
  ypcByTeam: Record<string, number>,
): GameResult {
  const events: PlayEvent[] = [];
  for (const [offenseTeamId, ypc] of Object.entries(ypcByTeam)) {
    const defenseTeamId = offenseTeamId === homeTeamId
      ? awayTeamId
      : homeTeamId;
    const carries = 25;
    for (let i = 0; i < carries; i++) {
      events.push({
        gameId,
        driveIndex: 0,
        playIndex: events.length,
        quarter: 1,
        clock: "15:00",
        situation: { down: 1, distance: 10, yardLine: 25 },
        offenseTeamId,
        defenseTeamId,
        call: {
          concept: "inside_zone",
          personnel: "11",
          formation: "singleback",
          motion: "none",
        },
        coverage: { front: "4-3", coverage: "cover_2", pressure: "four_man" },
        participants: [],
        outcome: "rush",
        yardage: ypc,
        tags: [],
      });
    }
  }
  return {
    gameId,
    seed: 1,
    finalScore: { home: 0, away: 0 },
    events,
    boxScore: {
      home: {
        totalYards: 0,
        passingYards: 0,
        rushingYards: 0,
        turnovers: 0,
        sacks: 0,
        penalties: 0,
      },
      away: {
        totalYards: 0,
        passingYards: 0,
        rushingYards: 0,
        turnovers: 0,
        sacks: 0,
        penalties: 0,
      },
    },
    driveLog: [],
    injuryReport: [],
  };
}

Deno.test("runRbCalibration runs the sim, buckets RBs, and returns a populated report", () => {
  // Build a league where each team's starter RB is at a different
  // overall, giving us one team per bucket. The stub simulate maps
  // each team's YPC directly to its RB overall so every bucket lands
  // in its target band.
  const overallByTeam: Record<string, number> = {
    "t30": 30,
    "t40": 40,
    "t50": 50,
    "t60": 60,
    "t70": 70,
    "t80": 80,
  };
  const ypcByOverall: Record<number, number> = {
    30: 3.6,
    40: 4.0,
    50: 4.3,
    60: 4.7,
    70: 5.4,
    80: 5.4,
  };

  const teams: SimTeam[] = Object.entries(overallByTeam).map(([id, o]) =>
    team(id, rbRuntime(`${id}-rb`, o))
  );
  const league: CalibrationLeague = { calibrationSeed: 1, teams };

  let gameCount = 0;
  const simulate = ({ home, away, gameId }: {
    home: SimTeam;
    away: SimTeam;
    seed: number;
    gameId: string;
  }): GameResult => {
    gameCount++;
    return makeGame(gameId, home.teamId, away.teamId, {
      [home.teamId]: ypcByOverall[overallByTeam[home.teamId]],
      [away.teamId]: ypcByOverall[overallByTeam[away.teamId]],
    });
  };

  const report = runRbCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: teams.length * 12,
    minSamplesPerBucket: 5,
  });

  assertEquals(report.totalGames, teams.length * 12);
  // Each matchup produces 2 samples (home + away RB).
  assertEquals(report.totalSamples, gameCount * 2);

  const fifty = report.buckets.find((b) => b.bucketLabel === "50")!;
  assertEquals(fifty.samples > 0, true);
  assertEquals(fifty.underSampled, false);
  assertEquals(fifty.checks.length > 0, true);
  const ypcCheck = fifty.checks.find((c) =>
    c.metricName === "yards_per_carry"
  )!;
  assertEquals(ypcCheck.passed, true);
});

Deno.test("runRbCalibration marks a bucket under-sampled when below min threshold", () => {
  const teams: SimTeam[] = [team("t50", rbRuntime("t50-rb", 50))];
  const league: CalibrationLeague = { calibrationSeed: 1, teams };
  const simulate = (
    { home, away, gameId }: {
      home: SimTeam;
      away: SimTeam;
      seed: number;
      gameId: string;
    },
  ) =>
    makeGame(gameId, home.teamId, away.teamId, {
      [home.teamId]: 4.3,
      [away.teamId]: 4.3,
    });

  const report = runRbCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: 1,
    minSamplesPerBucket: 100,
  });

  const fifty = report.buckets.find((b) => b.bucketLabel === "50")!;
  assertEquals(fifty.underSampled, true);
  assertEquals(fifty.checks.length, 0);
});

Deno.test("formatRbCalibrationReport renders a human-readable summary", () => {
  const teams: SimTeam[] = [team("t50", rbRuntime("t50-rb", 50))];
  const league: CalibrationLeague = { calibrationSeed: 1, teams };
  const simulate = (
    { home, away, gameId }: {
      home: SimTeam;
      away: SimTeam;
      seed: number;
      gameId: string;
    },
  ) =>
    makeGame(gameId, home.teamId, away.teamId, {
      [home.teamId]: 4.3,
      [away.teamId]: 4.3,
    });

  const report = runRbCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: 100,
    minSamplesPerBucket: 1,
  });
  const output = formatRbCalibrationReport(report);
  assertStringIncludes(output, "RB calibration");
  assertStringIncludes(output, "bucket 50");
  assertStringIncludes(output, "yards_per_carry");
});
