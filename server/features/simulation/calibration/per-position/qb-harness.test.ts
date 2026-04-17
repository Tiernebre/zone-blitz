import { assertEquals, assertStringIncludes } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { formatQbCalibrationReport, runQbCalibration } from "./qb-harness.ts";
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

function qbRuntime(id: string, overall: number): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: "QB",
    attributes: attrs({
      armStrength: overall,
      accuracyShort: overall,
      accuracyMedium: overall,
      accuracyDeep: overall,
      release: overall,
      decisionMaking: overall,
    }),
  };
}

function team(teamId: string, starterQb: PlayerRuntime): SimTeam {
  return {
    teamId,
    starters: [starterQb],
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
  const band = (mean: number, sd: number) => ({
    n: 20,
    metrics: {
      completion_pct: { n: 20, mean, sd },
      yards_per_attempt: { n: 20, mean: mean * 12, sd: sd * 2 },
      td_rate: { n: 20, mean: 0.04, sd: 0.01 },
      int_rate: { n: 20, mean: 0.02, sd: 0.005 },
      sack_rate: { n: 20, mean: 0.06, sd: 0.015 },
    },
  });
  return JSON.stringify({
    position: "QB",
    seasons: [2020, 2021, 2022, 2023, 2024],
    ranking_stat: "epa_per_play",
    bands: {
      elite: band(0.68, 0.025),
      good: band(0.66, 0.022),
      average: band(0.65, 0.024),
      weak: band(0.63, 0.03),
      replacement: band(0.6, 0.04),
    },
  });
}

function makeGame(
  gameId: string,
  homeTeamId: string,
  awayTeamId: string,
  completionByTeam: Record<string, number>,
): GameResult {
  const events: PlayEvent[] = [];
  for (
    const [offenseTeamId, completionPct] of Object.entries(completionByTeam)
  ) {
    const defenseTeamId = offenseTeamId === homeTeamId
      ? awayTeamId
      : homeTeamId;
    const attempts = 100;
    const completions = Math.round(attempts * completionPct);
    for (let i = 0; i < attempts; i++) {
      const isComplete = i < completions;
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
          concept: "dropback",
          personnel: "11",
          formation: "shotgun",
          motion: "none",
        },
        coverage: { front: "4-3", coverage: "cover_2", pressure: "four_man" },
        participants: [],
        outcome: isComplete ? "pass_complete" : "pass_incomplete",
        yardage: isComplete ? 7 : 0,
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

Deno.test("runQbCalibration runs the sim, buckets QBs, and returns a populated report", () => {
  // Build a league where each team's starter QB is at a different
  // overall, giving us one team per bucket. The stub simulate maps
  // each team's expected completion% directly to its QB overall so
  // every bucket lands in its target band.
  const overallByTeam: Record<string, number> = {
    "t30": 30,
    "t40": 40,
    "t50": 50,
    "t60": 60,
    "t70": 70,
    "t80": 80,
  };
  const completionByOverall: Record<number, number> = {
    30: 0.6,
    40: 0.63,
    50: 0.65,
    60: 0.66,
    70: 0.68,
    80: 0.68,
  };

  const teams: SimTeam[] = Object.entries(overallByTeam).map(([id, o]) =>
    team(id, qbRuntime(`${id}-qb`, o))
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
      [home.teamId]: completionByOverall[overallByTeam[home.teamId]],
      [away.teamId]: completionByOverall[overallByTeam[away.teamId]],
    });
  };

  const report = runQbCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: teams.length * 12,
    minSamplesPerBucket: 5,
  });

  assertEquals(report.totalGames, teams.length * 12);
  // Each matchup produces 2 samples (home + away QB).
  assertEquals(report.totalSamples, gameCount * 2);

  const fifty = report.buckets.find((b) => b.bucketLabel === "50")!;
  assertEquals(fifty.samples > 0, true);
  assertEquals(fifty.underSampled, false);
  assertEquals(fifty.checks.length > 0, true);
  const completionCheck = fifty.checks.find((c) =>
    c.metricName === "completion_pct"
  )!;
  assertEquals(completionCheck.passed, true);
});

Deno.test("runQbCalibration marks a bucket under-sampled when below min threshold", () => {
  const teams: SimTeam[] = [team("t50", qbRuntime("t50-qb", 50))];
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
      [home.teamId]: 0.65,
      [away.teamId]: 0.65,
    });

  const report = runQbCalibration({
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

Deno.test("formatQbCalibrationReport renders a human-readable summary", () => {
  const teams: SimTeam[] = [team("t50", qbRuntime("t50-qb", 50))];
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
      [home.teamId]: 0.65,
      [away.teamId]: 0.65,
    });

  const report = runQbCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: 100,
    minSamplesPerBucket: 1,
  });
  const output = formatQbCalibrationReport(report);
  assertStringIncludes(output, "QB calibration");
  assertStringIncludes(output, "bucket 50");
  assertStringIncludes(output, "completion_pct");
});
