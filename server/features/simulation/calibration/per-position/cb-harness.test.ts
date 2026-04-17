import { assertEquals, assertStringIncludes } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { formatCbCalibrationReport, runCbCalibration } from "./cb-harness.ts";
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

function cbRuntime(id: string, overall: number): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: "CB",
    attributes: attrs({
      manCoverage: overall,
      zoneCoverage: overall,
      speed: overall,
      agility: overall,
    }),
  };
}

function team(teamId: string, starterCb: PlayerRuntime): SimTeam {
  return {
    teamId,
    starters: [starterCb],
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

// Band fixture that mirrors the real CB fixture shape: pbus_per_game
// and ints_per_game carry real data; the other four metrics are n=0
// placeholders the harness must skip.
function bandJson(): string {
  const populatedBand = (pbus: number, ints: number) => ({
    n: 20,
    metrics: {
      targets_per_game: { n: 0, mean: 0, sd: 0 },
      completion_allowed_pct: { n: 0, mean: 0, sd: 0 },
      yards_per_target_allowed: { n: 0, mean: 0, sd: 0 },
      pbu_rate: { n: 0, mean: 0, sd: 0 },
      pbus_per_game: { n: 20, mean: pbus, sd: 0.2 },
      ints_per_game: { n: 20, mean: ints, sd: 0.1 },
    },
  });
  return JSON.stringify({
    position: "CB",
    seasons: [2020, 2021, 2022, 2023, 2024],
    ranking_stat: "event_rate",
    bands: {
      elite: populatedBand(1.1, 0.3),
      good: populatedBand(0.84, 0.17),
      average: populatedBand(0.59, 0.09),
      weak: populatedBand(0.43, 0.03),
      replacement: populatedBand(0.24, 0.01),
    },
  });
}

function makeGame(
  gameId: string,
  homeTeamId: string,
  awayTeamId: string,
  pbusPerGameByDefense: Record<string, number>,
): GameResult {
  // Emit `pbus` pass_incomplete plays per defense per game so each CB
  // on that defense ends up with that many PBUs (1 CB per team in the
  // test harness) — that gives us clean per-bucket means.
  const events: PlayEvent[] = [];
  for (
    const [defenseTeamId, pbus] of Object.entries(pbusPerGameByDefense)
  ) {
    const offenseTeamId = defenseTeamId === homeTeamId
      ? awayTeamId
      : homeTeamId;
    for (let i = 0; i < pbus; i++) {
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

Deno.test("runCbCalibration runs the sim, buckets CBs, and returns a populated report", () => {
  // One CB per team; each bucket gets its own team.
  const overallByTeam: Record<string, number> = {
    "t30": 30,
    "t40": 40,
    "t50": 50,
    "t60": 60,
    "t70": 70,
    "t80": 80,
  };
  const pbusPerGameByOverall: Record<number, number> = {
    30: 0, // sim PBUs per game matching the replacement band mean (0.24 → rounded to 0 in integer events)
    40: 0,
    50: 1, // close to average band mean 0.59
    60: 1, // good ≈ 0.84
    70: 1, // elite ≈ 1.1
    80: 1,
  };

  const teams: SimTeam[] = Object.entries(overallByTeam).map(([id, o]) =>
    team(id, cbRuntime(`${id}-cb`, o))
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
      [home.teamId]: pbusPerGameByOverall[overallByTeam[home.teamId]],
      [away.teamId]: pbusPerGameByOverall[overallByTeam[away.teamId]],
    });
  };

  const report = runCbCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: teams.length * 12,
    minSamplesPerBucket: 5,
  });

  assertEquals(report.totalGames, teams.length * 12);
  // One CB per team, two teams per matchup → 2 samples per game.
  assertEquals(report.totalSamples, gameCount * 2);

  const fifty = report.buckets.find((b) => b.bucketLabel === "50")!;
  assertEquals(fifty.samples > 0, true);
  assertEquals(fifty.underSampled, false);
  // Only two populated metrics should produce checks (pbus_per_game +
  // ints_per_game); the four placeholder metrics are skipped because
  // the expected band has n=0.
  assertEquals(fifty.checks.length, 2);
  const metricNames = fifty.checks.map((c) => c.metricName).sort();
  assertEquals(metricNames, ["ints_per_game", "pbus_per_game"]);
});

Deno.test("runCbCalibration marks a bucket under-sampled when below min threshold", () => {
  const teams: SimTeam[] = [team("t50", cbRuntime("t50-cb", 50))];
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
      [home.teamId]: 1,
      [away.teamId]: 1,
    });

  const report = runCbCalibration({
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

Deno.test("runCbCalibration skips placeholder (n=0) fixture metrics", () => {
  // Using a fixture where *every* metric is n=0 should produce zero
  // checks per bucket, even when buckets are well-sampled.
  const emptyFixture = JSON.stringify({
    position: "CB",
    seasons: [2020, 2021, 2022, 2023, 2024],
    ranking_stat: "event_rate",
    bands: {
      elite: {
        n: 20,
        metrics: {
          targets_per_game: { n: 0, mean: 0, sd: 0 },
          completion_allowed_pct: { n: 0, mean: 0, sd: 0 },
          yards_per_target_allowed: { n: 0, mean: 0, sd: 0 },
          pbu_rate: { n: 0, mean: 0, sd: 0 },
          pbus_per_game: { n: 0, mean: 0, sd: 0 },
          ints_per_game: { n: 0, mean: 0, sd: 0 },
        },
      },
      good: {
        n: 20,
        metrics: {
          targets_per_game: { n: 0, mean: 0, sd: 0 },
          completion_allowed_pct: { n: 0, mean: 0, sd: 0 },
          yards_per_target_allowed: { n: 0, mean: 0, sd: 0 },
          pbu_rate: { n: 0, mean: 0, sd: 0 },
          pbus_per_game: { n: 0, mean: 0, sd: 0 },
          ints_per_game: { n: 0, mean: 0, sd: 0 },
        },
      },
      average: {
        n: 20,
        metrics: {
          targets_per_game: { n: 0, mean: 0, sd: 0 },
          completion_allowed_pct: { n: 0, mean: 0, sd: 0 },
          yards_per_target_allowed: { n: 0, mean: 0, sd: 0 },
          pbu_rate: { n: 0, mean: 0, sd: 0 },
          pbus_per_game: { n: 0, mean: 0, sd: 0 },
          ints_per_game: { n: 0, mean: 0, sd: 0 },
        },
      },
      weak: {
        n: 20,
        metrics: {
          targets_per_game: { n: 0, mean: 0, sd: 0 },
          completion_allowed_pct: { n: 0, mean: 0, sd: 0 },
          yards_per_target_allowed: { n: 0, mean: 0, sd: 0 },
          pbu_rate: { n: 0, mean: 0, sd: 0 },
          pbus_per_game: { n: 0, mean: 0, sd: 0 },
          ints_per_game: { n: 0, mean: 0, sd: 0 },
        },
      },
      replacement: {
        n: 20,
        metrics: {
          targets_per_game: { n: 0, mean: 0, sd: 0 },
          completion_allowed_pct: { n: 0, mean: 0, sd: 0 },
          yards_per_target_allowed: { n: 0, mean: 0, sd: 0 },
          pbu_rate: { n: 0, mean: 0, sd: 0 },
          pbus_per_game: { n: 0, mean: 0, sd: 0 },
          ints_per_game: { n: 0, mean: 0, sd: 0 },
        },
      },
    },
  });

  const teams: SimTeam[] = [team("t50", cbRuntime("t50-cb", 50))];
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
      [home.teamId]: 1,
      [away.teamId]: 1,
    });

  const report = runCbCalibration({
    bandJson: emptyFixture,
    league,
    simulate,
    gameCount: 20,
    minSamplesPerBucket: 1,
  });

  const fifty = report.buckets.find((b) => b.bucketLabel === "50")!;
  assertEquals(fifty.checks.length, 0);
  assertEquals(report.failures.length, 0);
  assertEquals(report.passed, true);
});

Deno.test("formatCbCalibrationReport renders a human-readable summary", () => {
  const teams: SimTeam[] = [team("t50", cbRuntime("t50-cb", 50))];
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
      [home.teamId]: 1,
      [away.teamId]: 1,
    });

  const report = runCbCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: 100,
    minSamplesPerBucket: 1,
  });
  const output = formatCbCalibrationReport(report);
  assertStringIncludes(output, "CB calibration");
  assertStringIncludes(output, "bucket 50");
  assertStringIncludes(output, "pbus_per_game");
});
