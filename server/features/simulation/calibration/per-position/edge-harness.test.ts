import { assertEquals, assertStringIncludes } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import {
  formatEdgeCalibrationReport,
  runEdgeCalibration,
} from "./edge-harness.ts";
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

function edgeRuntime(id: string, overall: number): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: "EDGE",
    attributes: attrs({
      passRushing: overall,
      acceleration: overall,
      strength: overall,
      blockShedding: overall,
      runDefense: overall,
    }),
  };
}

function team(teamId: string, starterEdge: PlayerRuntime): SimTeam {
  return {
    teamId,
    starters: [starterEdge],
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
  // Synthetic bands whose means spread monotonically across the 5
  // percentile bins — mirrors the real EDGE fixture shape (higher =
  // better pass-rush output) while keeping the fixture small and
  // inline-readable. sd is set wide enough that a sim mean within one
  // sd lands in the correct band for each bucket.
  const band = (sacks: number, hits: number, tfls: number) => ({
    n: 20,
    metrics: {
      sacks_per_game: { n: 20, mean: sacks, sd: 0.08 },
      qb_hits_per_game: { n: 20, mean: hits, sd: 0.12 },
      tfl_per_game: { n: 20, mean: tfls, sd: 0.1 },
    },
  });
  return JSON.stringify({
    position: "EDGE",
    seasons: [2021, 2022, 2023, 2024, 2025],
    ranking_stat: "rush_composite",
    bands: {
      elite: band(0.9, 1.9, 1.08),
      good: band(0.62, 1.36, 0.72),
      average: band(0.41, 0.95, 0.48),
      weak: band(0.27, 0.65, 0.35),
      replacement: band(0.21, 0.53, 0.24),
    },
  });
}

function makeGame(
  gameId: string,
  homeTeamId: string,
  awayTeamId: string,
  sacksByDefense: Record<string, number>,
  pressuresByDefense: Record<string, number>,
): GameResult {
  const events: PlayEvent[] = [];
  for (const [defenseTeamId, sackCount] of Object.entries(sacksByDefense)) {
    const offenseTeamId = defenseTeamId === homeTeamId
      ? awayTeamId
      : homeTeamId;
    // Sacks credited to the starter EDGE via participant tag.
    const edgePlayerId = `${defenseTeamId}-edge`;
    for (let i = 0; i < sackCount; i++) {
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
        participants: [
          { role: "pass_rush", playerId: edgePlayerId, tags: ["sack"] },
        ],
        outcome: "sack",
        yardage: -7,
        tags: ["sack", "pressure"],
      });
    }
  }
  for (
    const [defenseTeamId, pressureCount] of Object.entries(pressuresByDefense)
  ) {
    const offenseTeamId = defenseTeamId === homeTeamId
      ? awayTeamId
      : homeTeamId;
    for (let i = 0; i < pressureCount; i++) {
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
        outcome: "pass_incomplete",
        yardage: 0,
        tags: ["pressure"],
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

Deno.test("runEdgeCalibration runs the sim, buckets EDGEs, and returns a populated report", () => {
  // Build a league where each team's EDGE starter is at a different
  // overall, giving us one team per bucket. The stub simulate maps
  // each defense's sacks+pressures to its EDGE overall so each
  // bucket lands in its target band on sacks_per_game and qb_hits.
  const overallByTeam: Record<string, number> = {
    "t30": 30,
    "t40": 40,
    "t50": 50,
    "t60": 60,
    "t70": 70,
    "t80": 80,
  };
  const sacksByOverall: Record<number, number> = {
    30: 0.21,
    40: 0.27,
    50: 0.41,
    60: 0.62,
    70: 0.9,
    80: 0.9,
  };
  const pressuresByOverall: Record<number, number> = {
    30: 0.53,
    40: 0.65,
    50: 0.95,
    60: 1.36,
    70: 1.9,
    80: 1.9,
  };

  const teams: SimTeam[] = Object.entries(overallByTeam).map(([id, o]) =>
    team(id, edgeRuntime(`${id}-edge`, o))
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
    // Use fractional rates directly as event counts since this is a
    // one-game sample — the harness averages across games. For exact
    // bucket means we scale the rates into integer counts per game by
    // interpreting them as counts (one game represents the rate).
    return makeGame(
      gameId,
      home.teamId,
      away.teamId,
      {
        [home.teamId]: sacksByOverall[overallByTeam[home.teamId]],
        [away.teamId]: sacksByOverall[overallByTeam[away.teamId]],
      },
      {
        [home.teamId]: pressuresByOverall[overallByTeam[home.teamId]],
        [away.teamId]: pressuresByOverall[overallByTeam[away.teamId]],
      },
    );
  };

  const report = runEdgeCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: teams.length * 12,
    minSamplesPerBucket: 5,
  });

  assertEquals(report.totalGames, teams.length * 12);
  // Each matchup produces 2 samples (home + away EDGE starter).
  assertEquals(report.totalSamples, gameCount * 2);

  const fifty = report.buckets.find((b) => b.bucketLabel === "50")!;
  assertEquals(fifty.samples > 0, true);
  assertEquals(fifty.underSampled, false);
  assertEquals(fifty.checks.length > 0, true);
  // Every bucket should report checks on all three proxy metrics.
  assertEquals(fifty.checks.length, 3);
  const metricNames = fifty.checks.map((c) => c.metricName).sort();
  assertEquals(metricNames, [
    "qb_hits_per_game",
    "sacks_per_game",
    "tfl_per_game",
  ]);
});

Deno.test("runEdgeCalibration marks a bucket under-sampled when below min threshold", () => {
  const teams: SimTeam[] = [team("t50", edgeRuntime("t50-edge", 50))];
  const league: CalibrationLeague = { calibrationSeed: 1, teams };
  const simulate = (
    { home, away, gameId }: {
      home: SimTeam;
      away: SimTeam;
      seed: number;
      gameId: string;
    },
  ) =>
    makeGame(
      gameId,
      home.teamId,
      away.teamId,
      { [home.teamId]: 0, [away.teamId]: 0 },
      { [home.teamId]: 0, [away.teamId]: 0 },
    );

  const report = runEdgeCalibration({
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

Deno.test("runEdgeCalibration flags tfl_per_game as a FAIL-low band check (proxy gap)", () => {
  // Documented v1 limitation: sim never emits TFL events, so the
  // bucket's sim mean for tfl_per_game is 0. The 50-overall bucket
  // expects the "average" band mean (~0.48 in the fixture below),
  // which is multiple sds above 0 — so the band check fails low.
  const teams: SimTeam[] = [team("t50", edgeRuntime("t50-edge", 50))];
  const league: CalibrationLeague = { calibrationSeed: 1, teams };
  const simulate = (
    { home, away, gameId }: {
      home: SimTeam;
      away: SimTeam;
      seed: number;
      gameId: string;
    },
  ) =>
    makeGame(
      gameId,
      home.teamId,
      away.teamId,
      { [home.teamId]: 0.41, [away.teamId]: 0.41 },
      { [home.teamId]: 0.95, [away.teamId]: 0.95 },
    );

  const report = runEdgeCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: 100,
    minSamplesPerBucket: 1,
  });

  const fifty = report.buckets.find((b) => b.bucketLabel === "50")!;
  const tflCheck = fifty.checks.find((c) => c.metricName === "tfl_per_game")!;
  assertEquals(tflCheck.passed, false);
  assertEquals(tflCheck.direction, "too_low");
});

Deno.test("formatEdgeCalibrationReport renders a human-readable summary", () => {
  const teams: SimTeam[] = [team("t50", edgeRuntime("t50-edge", 50))];
  const league: CalibrationLeague = { calibrationSeed: 1, teams };
  const simulate = (
    { home, away, gameId }: {
      home: SimTeam;
      away: SimTeam;
      seed: number;
      gameId: string;
    },
  ) =>
    makeGame(
      gameId,
      home.teamId,
      away.teamId,
      { [home.teamId]: 0.41, [away.teamId]: 0.41 },
      { [home.teamId]: 0.95, [away.teamId]: 0.95 },
    );

  const report = runEdgeCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: 50,
    minSamplesPerBucket: 1,
  });
  const output = formatEdgeCalibrationReport(report);
  assertStringIncludes(output, "EDGE calibration");
  assertStringIncludes(output, "Proxy metrics");
  assertStringIncludes(output, "bucket 50");
  assertStringIncludes(output, "sacks_per_game");
});
