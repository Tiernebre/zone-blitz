import { assertEquals, assertStringIncludes } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { formatWrCalibrationReport, runWrCalibration } from "./wr-harness.ts";
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

function wrRuntime(id: string, overall: number): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: "WR",
    attributes: attrs({
      routeRunning: overall,
      catching: overall,
      speed: overall,
      release: overall,
    }),
  };
}

function team(teamId: string, starterWr: PlayerRuntime): SimTeam {
  // Single-WR teams keep the harness test deterministic: every team's
  // pass allocation lands on its one starter WR at a known overall.
  return {
    teamId,
    starters: [starterWr],
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
  // NFL-shaped bands — elite WRs catch a higher share of their targets
  // at more yards-per-target and TD%, replacement WRs catch fewer.
  // yards_per_game scales with yards_per_target for the stub.
  const band = (catchRate: number, ypt: number, tdRate: number) => ({
    n: 20,
    metrics: {
      catch_rate: { n: 20, mean: catchRate, sd: 0.05 },
      yards_per_reception: { n: 20, mean: ypt / catchRate, sd: 1.5 },
      yards_per_target: { n: 20, mean: ypt, sd: 0.8 },
      td_rate: { n: 20, mean: tdRate, sd: 0.015 },
      yards_per_game: { n: 20, mean: ypt * 9, sd: 15 },
    },
  });
  return JSON.stringify({
    position: "WR",
    seasons: [2020, 2021, 2022, 2023, 2024],
    ranking_stat: "epa_per_play",
    bands: {
      elite: band(0.71, 10.1, 0.084),
      good: band(0.68, 9.4, 0.063),
      average: band(0.65, 8.3, 0.048),
      weak: band(0.62, 7.2, 0.035),
      replacement: band(0.58, 6.5, 0.028),
    },
  });
}

function makeGame(
  gameId: string,
  homeTeamId: string,
  awayTeamId: string,
  profile: Record<string, { catchRate: number; ypt: number; tdRate: number }>,
): GameResult {
  // Synthesize exactly 50 passing events per team so the sim matches
  // the target profile with integer counts: receptions = round(50 *
  // catchRate), of which round(50 * tdRate) are TDs.
  const events: PlayEvent[] = [];
  const TARGETS = 50;
  for (const [offenseTeamId, p] of Object.entries(profile)) {
    const defenseTeamId = offenseTeamId === homeTeamId
      ? awayTeamId
      : homeTeamId;
    const receptions = Math.round(TARGETS * p.catchRate);
    const tds = Math.round(TARGETS * p.tdRate);
    const regularCompletions = receptions - tds;
    const incompletes = TARGETS - receptions;
    // Each reception gains ypt * targets / receptions yards so the
    // per-target average matches the profile exactly.
    const yardsPerReception = (p.ypt * TARGETS) / receptions;

    for (let i = 0; i < regularCompletions; i++) {
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
        outcome: "pass_complete",
        yardage: yardsPerReception,
        tags: [],
      });
    }
    for (let i = 0; i < tds; i++) {
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
        outcome: "touchdown",
        yardage: yardsPerReception,
        tags: [],
      });
    }
    for (let i = 0; i < incompletes; i++) {
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

Deno.test("runWrCalibration runs the sim, buckets WRs, and returns a populated report", () => {
  // Build a league where each team's starter WR is at a different
  // overall, giving us one team per bucket. The stub simulate maps
  // each team's pass profile directly to its WR overall so every
  // bucket lands in its target band.
  const overallByTeam: Record<string, number> = {
    "t30": 30,
    "t40": 40,
    "t50": 50,
    "t60": 60,
    "t70": 70,
    "t80": 80,
  };
  const profileByOverall: Record<
    number,
    { catchRate: number; ypt: number; tdRate: number }
  > = {
    30: { catchRate: 0.58, ypt: 6.5, tdRate: 0.028 },
    40: { catchRate: 0.62, ypt: 7.2, tdRate: 0.035 },
    50: { catchRate: 0.65, ypt: 8.3, tdRate: 0.048 },
    60: { catchRate: 0.68, ypt: 9.4, tdRate: 0.063 },
    70: { catchRate: 0.71, ypt: 10.1, tdRate: 0.084 },
    80: { catchRate: 0.71, ypt: 10.1, tdRate: 0.084 },
  };

  const teams: SimTeam[] = Object.entries(overallByTeam).map(([id, o]) =>
    team(id, wrRuntime(`${id}-wr`, o))
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
      [home.teamId]: profileByOverall[overallByTeam[home.teamId]],
      [away.teamId]: profileByOverall[overallByTeam[away.teamId]],
    });
  };

  const report = runWrCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: teams.length * 12,
    minSamplesPerBucket: 5,
  });

  assertEquals(report.totalGames, teams.length * 12);
  // Each matchup produces 2 samples (home + away starter WR).
  assertEquals(report.totalSamples, gameCount * 2);

  const fifty = report.buckets.find((b) => b.bucketLabel === "50")!;
  assertEquals(fifty.samples > 0, true);
  assertEquals(fifty.underSampled, false);
  assertEquals(fifty.checks.length > 0, true);
  const catchCheck = fifty.checks.find((c) => c.metricName === "catch_rate")!;
  assertEquals(catchCheck.passed, true);
});

Deno.test("runWrCalibration marks a bucket under-sampled when below min threshold", () => {
  const teams: SimTeam[] = [team("t50", wrRuntime("t50-wr", 50))];
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
      [home.teamId]: { catchRate: 0.65, ypt: 8.3, tdRate: 0.048 },
      [away.teamId]: { catchRate: 0.65, ypt: 8.3, tdRate: 0.048 },
    });

  const report = runWrCalibration({
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

Deno.test("formatWrCalibrationReport renders a human-readable summary", () => {
  const teams: SimTeam[] = [team("t50", wrRuntime("t50-wr", 50))];
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
      [home.teamId]: { catchRate: 0.65, ypt: 8.3, tdRate: 0.048 },
      [away.teamId]: { catchRate: 0.65, ypt: 8.3, tdRate: 0.048 },
    });

  const report = runWrCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: 100,
    minSamplesPerBucket: 1,
  });
  const output = formatWrCalibrationReport(report);
  assertStringIncludes(output, "WR calibration");
  assertStringIncludes(output, "bucket 50");
  assertStringIncludes(output, "catch_rate");
});
