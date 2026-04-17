import { assert, assertEquals } from "@std/assert";
import { generateMatchups, runCalibration } from "./harness.ts";
import type { MetricBand } from "./band-loader.ts";
import type { CalibrationLeague } from "./generate-calibration-league.ts";
import type { SimTeam } from "../simulate-game.ts";
import type { GameResult, PlayEvent } from "../events.ts";

function makeMinimalTeam(id: string): SimTeam {
  return {
    teamId: id,
    starters: [],
    bench: [],
    fingerprint: {
      offense: {
        runPassLean: 50,
        tempo: 50,
        personnelWeight: 50,
        formationUnderCenterShotgun: 50,
        preSnapMotionRate: 50,
        passingStyle: 50,
        passingDepth: 50,
        runGameBlocking: 50,
        rpoIntegration: 50,
      },
      defense: {
        frontOddEven: 50,
        gapResponsibility: 50,
        subPackageLean: 50,
        coverageManZone: 50,
        coverageShell: 50,
        cornerPressOff: 50,
        pressureRate: 50,
        disguiseRate: 50,
      },
      overrides: {},
    },
    coachingMods: {
      schemeFitBonus: 0,
      situationalBonus: 0,
      aggressiveness: 50,
      penaltyDiscipline: 1,
    },
  };
}

function makeLeague(teamCount: number): CalibrationLeague {
  const teams: SimTeam[] = [];
  for (let i = 0; i < teamCount; i++) {
    teams.push(makeMinimalTeam(`team-${i}`));
  }
  return { calibrationSeed: 0xCA1_B0021, teams };
}

function makeBandJson(
  metricOverrides?: Record<string, Partial<MetricBand>>,
): string {
  const defaultBand: MetricBand = {
    n: 2686,
    mean: 50,
    sd: 10,
    min: 20,
    p10: 35,
    p25: 42,
    p50: 50,
    p75: 58,
    p90: 65,
    max: 80,
  };

  const metrics = [
    "plays",
    "pass_attempts",
    "rush_attempts",
    "pass_rate",
    "rush_rate",
    "completion_pct",
    "yards_per_attempt",
    "yards_per_carry",
    "pass_yards",
    "rush_yards",
    "sacks_taken",
    "interceptions",
    "fumbles_lost",
    "turnovers",
    "penalties",
  ];

  const bands: Record<string, MetricBand> = {};
  for (const m of metrics) {
    bands[m] = { ...defaultBand, ...metricOverrides?.[m] };
  }

  return JSON.stringify({
    generated_at: "2026-01-01T00:00:00Z",
    seasons: [2020],
    notes: "test",
    bands,
  });
}

Deno.test("generateMatchups creates correct number of games", () => {
  const league = makeLeague(4);
  const matchups = generateMatchups(league.teams, 10);
  assertEquals(matchups.length, 10);
});

Deno.test("generateMatchups uses all teams", () => {
  const league = makeLeague(4);
  const matchups = generateMatchups(league.teams, 8);
  const teamsSeen = new Set<string>();
  for (const m of matchups) {
    teamsSeen.add(m.home.teamId);
    teamsSeen.add(m.away.teamId);
  }
  assertEquals(teamsSeen.size, 4);
});

Deno.test("generateMatchups never pairs team against itself", () => {
  const league = makeLeague(32);
  const matchups = generateMatchups(league.teams, 1344);
  for (const m of matchups) {
    assert(
      m.home.teamId !== m.away.teamId,
      `team ${m.home.teamId} matched against itself`,
    );
  }
});

Deno.test("runCalibration with mock simulator reports all metrics", () => {
  const mockSimulate = (
    input: { home: SimTeam; away: SimTeam; seed: number; gameId: string },
  ): GameResult => {
    const events: PlayEvent[] = [];
    for (let i = 0; i < 30; i++) {
      events.push({
        gameId: input.gameId,
        driveIndex: 0,
        playIndex: i,
        quarter: 1,
        clock: "15:00",
        situation: { down: 1, distance: 10, yardLine: 25 },
        offenseTeamId: i % 2 === 0 ? input.home.teamId : input.away.teamId,
        defenseTeamId: i % 2 === 0 ? input.away.teamId : input.home.teamId,
        call: {
          concept: i % 3 === 0 ? "inside_zone" : "slant",
          personnel: "11",
          formation: "shotgun",
          motion: "none",
        },
        coverage: { front: "4-3", coverage: "cover3", pressure: "none" },
        participants: [],
        outcome: i % 3 === 0
          ? "rush"
          : i % 3 === 1
          ? "pass_complete"
          : "pass_incomplete",
        yardage: i % 3 === 0 ? 4 : i % 3 === 1 ? 8 : 0,
        tags: [],
      });
    }
    return {
      gameId: input.gameId,
      seed: input.seed,
      finalScore: { home: 14, away: 10 },
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
  };

  const league = makeLeague(4);
  const bandJson = makeBandJson();
  const report = runCalibration({
    bandJson,
    league,
    gameCount: 4,
    simulate: mockSimulate,
  });

  assertEquals(report.totalGames, 4);
  assertEquals(report.totalTeamGames, 8);
  assertEquals(report.results.length, 15);
});

Deno.test("runCalibration reports failures correctly", () => {
  const mockSimulate = (
    input: { home: SimTeam; away: SimTeam; seed: number; gameId: string },
  ): GameResult => {
    const events: PlayEvent[] = [];
    for (let i = 0; i < 10; i++) {
      events.push({
        gameId: input.gameId,
        driveIndex: 0,
        playIndex: i,
        quarter: 1,
        clock: "15:00",
        situation: { down: 1, distance: 10, yardLine: 25 },
        offenseTeamId: input.home.teamId,
        defenseTeamId: input.away.teamId,
        call: {
          concept: "inside_zone",
          personnel: "11",
          formation: "shotgun",
          motion: "none",
        },
        coverage: { front: "4-3", coverage: "cover3", pressure: "none" },
        participants: [],
        outcome: "rush",
        yardage: 4,
        tags: [],
      });
    }
    return {
      gameId: input.gameId,
      seed: input.seed,
      finalScore: { home: 7, away: 0 },
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
  };

  const league = makeLeague(4);
  const bandJson = makeBandJson({
    plays: {
      n: 2686,
      mean: 62.27,
      sd: 8.35,
      min: 33,
      p10: 52,
      p25: 57,
      p50: 62,
      p75: 68,
      p90: 73,
      max: 94,
    },
  });
  const report = runCalibration({
    bandJson,
    league,
    gameCount: 4,
    simulate: mockSimulate,
  });

  assertEquals(report.passed, false);
  assert(report.failures.length > 0, "expected at least one failure");
});

Deno.test("runCalibration passed is true when all gates pass", () => {
  let gameIdx = 0;
  const mockSimulate = (
    input: { home: SimTeam; away: SimTeam; seed: number; gameId: string },
  ): GameResult => {
    const events: PlayEvent[] = [];
    const variation = gameIdx * 4;
    gameIdx++;
    const playCount = 50 + variation;
    for (let i = 0; i < playCount; i++) {
      const isHome = i % 2 === 0;
      events.push({
        gameId: input.gameId,
        driveIndex: 0,
        playIndex: i,
        quarter: 1,
        clock: "15:00",
        situation: { down: 1, distance: 10, yardLine: 25 },
        offenseTeamId: isHome ? input.home.teamId : input.away.teamId,
        defenseTeamId: isHome ? input.away.teamId : input.home.teamId,
        call: {
          concept: "inside_zone",
          personnel: "11",
          formation: "shotgun",
          motion: "none",
        },
        coverage: { front: "4-3", coverage: "cover3", pressure: "none" },
        participants: [],
        outcome: "rush",
        yardage: 4 + (i % 3),
        tags: [],
      });
    }
    return {
      gameId: input.gameId,
      seed: input.seed,
      finalScore: { home: 14, away: 10 },
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
  };

  const league = makeLeague(4);
  // Bands must match mock sim output distributions exactly
  const permissiveBand = (mean: number, sd: number): MetricBand => ({
    n: 100,
    mean,
    sd,
    min: mean - 4 * Math.max(sd, 1),
    p10: mean - 2 * Math.max(sd, 1),
    p25: mean - Math.max(sd, 1),
    p50: mean,
    p75: mean + Math.max(sd, 1),
    p90: mean + 2 * Math.max(sd, 1),
    max: mean + 4 * Math.max(sd, 1),
  });

  const bandJson = makeBandJson({
    plays: permissiveBand(28, 2.8),
    rush_attempts: permissiveBand(28, 2.8),
    pass_attempts: permissiveBand(0, 0),
    pass_rate: permissiveBand(0, 0),
    rush_rate: permissiveBand(1, 0),
    completion_pct: permissiveBand(0, 0),
    yards_per_attempt: permissiveBand(0, 0),
    yards_per_carry: permissiveBand(5, 0.022),
    pass_yards: permissiveBand(0, 0),
    rush_yards: permissiveBand(140, 14),
    sacks_taken: permissiveBand(0, 0),
    interceptions: permissiveBand(0, 0),
    fumbles_lost: permissiveBand(0, 0),
    turnovers: permissiveBand(0, 0),
    penalties: permissiveBand(0, 0),
  });
  const report = runCalibration({
    bandJson,
    league,
    gameCount: 4,
    simulate: mockSimulate,
  });

  assertEquals(report.passed, true);
  assertEquals(report.failures.length, 0);
});
