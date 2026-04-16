import {
  assertEquals,
  assertExists,
  assertGreater,
  assertLessOrEqual,
} from "@std/assert";
import { simulateSeason } from "./simulate-season.ts";
import { computeSeasonAggregates } from "./season-aggregates.ts";
import { createSpyLogger } from "./simulation-logger.test.ts";

// NFL target bands from game-simulation north-star.
// Current engine does not hit all targets; these serve as the tuning yardstick.
// See docs/product/north-star/game-simulation.md §NFL-as-the-benchmark.
export const NFL_BANDS = {
  playsPerGame: { min: 125, max: 135 },
  passPercentage: { min: 55, max: 60 },
  rushPercentage: { min: 40, max: 45 },
  completionPercentage: { min: 60, max: 70 },
  yardsPerAttempt: { min: 6.5, max: 8.0 },
  yardsPerCarry: { min: 4.0, max: 4.7 },
  sacksPerTeamPerGame: { min: 2.0, max: 2.5 },
  turnoversPerTeamPerGame: { min: 1.0, max: 1.6 },
} as const;

// Regression bands: wider tolerances the engine can currently hit.
// Tighten these toward NFL_BANDS as the resolution pipeline is tuned.
const REGRESSION_BANDS = {
  playsPerGame: { min: 80, max: 180 },
  passPercentage: { min: 40, max: 75 },
  rushPercentage: { min: 25, max: 60 },
  completionPercentage: { min: 50, max: 90 },
  yardsPerAttempt: { min: 3.0, max: 12.0 },
  yardsPerCarry: { min: 2.0, max: 7.0 },
  sacksPerTeamPerGame: { min: 0.1, max: 6.0 },
  turnoversPerTeamPerGame: { min: 0.1, max: 4.0 },
} as const;

Deno.test("simulateSeason produces 272 games for a 32-team, 17-game season", () => {
  const season = simulateSeason({ leagueSeed: 2026 });
  assertEquals(season.results.length, 272);
});

Deno.test("simulateSeason is deterministic for the same seed", () => {
  const season1 = simulateSeason({
    leagueSeed: 42,
    teamCount: 8,
    gamesPerTeam: 7,
  });
  const season2 = simulateSeason({
    leagueSeed: 42,
    teamCount: 8,
    gamesPerTeam: 7,
  });
  assertEquals(season1.results.length, season2.results.length);
  for (let i = 0; i < season1.results.length; i++) {
    assertEquals(season1.results[i].finalScore, season2.results[i].finalScore);
  }
});

Deno.test("simulateSeason produces different results for different seeds", () => {
  const season1 = simulateSeason({
    leagueSeed: 1,
    teamCount: 8,
    gamesPerTeam: 7,
  });
  const season2 = simulateSeason({
    leagueSeed: 999,
    teamCount: 8,
    gamesPerTeam: 7,
  });
  let allSame = true;
  for (
    let i = 0;
    i < Math.min(season1.results.length, season2.results.length);
    i++
  ) {
    if (
      season1.results[i].finalScore.home !==
        season2.results[i].finalScore.home ||
      season1.results[i].finalScore.away !== season2.results[i].finalScore.away
    ) {
      allSame = false;
      break;
    }
  }
  assertEquals(allSame, false);
});

Deno.test("simulateSeason records elapsed time", () => {
  const season = simulateSeason({
    leagueSeed: 42,
    teamCount: 4,
    gamesPerTeam: 3,
  });
  assertGreater(season.elapsedMs, 0);
});

Deno.test("PERF: 272-game season completes under 60 seconds", () => {
  const season = simulateSeason({ leagueSeed: 2026 });
  assertLessOrEqual(
    season.elapsedMs,
    60_000,
    `Season took ${(season.elapsedMs / 1000).toFixed(1)}s — exceeds 60s target`,
  );
  assertGreater(season.results.length, 0);
});

function assertBand(
  value: number,
  band: { min: number; max: number },
  label: string,
): void {
  assertGreater(
    value,
    band.min,
    `${label} = ${value.toFixed(2)} below ${band.min}`,
  );
  assertLessOrEqual(
    value,
    band.max,
    `${label} = ${value.toFixed(2)} above ${band.max}`,
  );
}

Deno.test("simulateSeason aggregates land inside regression bands", () => {
  const season = simulateSeason({ leagueSeed: 2026 });
  const agg = computeSeasonAggregates(season.results);

  assertBand(agg.playsPerGame, REGRESSION_BANDS.playsPerGame, "plays/game");
  assertBand(agg.passPercentage, REGRESSION_BANDS.passPercentage, "pass %");
  assertBand(agg.rushPercentage, REGRESSION_BANDS.rushPercentage, "rush %");
  assertBand(
    agg.completionPercentage,
    REGRESSION_BANDS.completionPercentage,
    "completion %",
  );
  assertBand(
    agg.yardsPerAttempt,
    REGRESSION_BANDS.yardsPerAttempt,
    "yards/attempt",
  );
  assertBand(agg.yardsPerCarry, REGRESSION_BANDS.yardsPerCarry, "yards/carry");
  assertBand(
    agg.sacksPerTeamPerGame,
    REGRESSION_BANDS.sacksPerTeamPerGame,
    "sacks/team/game",
  );
  assertBand(
    agg.turnoversPerTeamPerGame,
    REGRESSION_BANDS.turnoversPerTeamPerGame,
    "TO/team/game",
  );
});

Deno.test("simulateSeason logging: accepts optional logger without changing results", () => {
  const { logger } = createSpyLogger();
  const without = simulateSeason({
    leagueSeed: 42,
    teamCount: 4,
    gamesPerTeam: 3,
  });
  const withLog = simulateSeason({
    leagueSeed: 42,
    teamCount: 4,
    gamesPerTeam: 3,
    log: logger,
  });

  assertEquals(withLog.results.length, without.results.length);
  for (let i = 0; i < without.results.length; i++) {
    assertEquals(withLog.results[i].finalScore, without.results[i].finalScore);
  }
});

Deno.test("simulateSeason logging: emits season start and end info logs", () => {
  const { logger, calls } = createSpyLogger();
  simulateSeason({
    leagueSeed: 42,
    teamCount: 4,
    gamesPerTeam: 3,
    log: logger,
  });

  const startLogs = calls.filter((c) => c.msg === "season simulation started");
  const endLogs = calls.filter((c) => c.msg === "season simulation ended");
  assertEquals(startLogs.length, 1);
  assertEquals(startLogs[0].level, "info");
  assertExists(startLogs[0].obj.teamCount);
  assertEquals(endLogs.length, 1);
  assertEquals(endLogs[0].level, "info");
  assertExists(endLogs[0].obj.elapsedMs);
  assertExists(endLogs[0].obj.totalGames);
});

Deno.test("simulateSeason logging: emits week progress debug logs", () => {
  const { logger, calls } = createSpyLogger();
  simulateSeason({
    leagueSeed: 42,
    teamCount: 4,
    gamesPerTeam: 3,
    log: logger,
  });

  const weekLogs = calls.filter((c) => c.msg === "week simulated");
  assertGreater(weekLogs.length, 0);
  assertEquals(weekLogs[0].level, "debug");
  assertExists(weekLogs[0].obj.week);
  assertExists(weekLogs[0].obj.gamesInWeek);
});

Deno.test("simulateSeason logging: passes logger to individual games", () => {
  const { logger, calls } = createSpyLogger();
  simulateSeason({
    leagueSeed: 42,
    teamCount: 4,
    gamesPerTeam: 3,
    log: logger,
  });

  // Each game should emit "game started" and "game ended"
  const gameStartLogs = calls.filter((c) => c.msg === "game started");
  const gameEndLogs = calls.filter((c) => c.msg === "game ended");
  assertGreater(gameStartLogs.length, 0);
  assertEquals(gameStartLogs.length, gameEndLogs.length);
});

Deno.test("PERF: NFL-band calibration report measures distance to NFL targets", () => {
  const season = simulateSeason({ leagueSeed: 2026 });
  const agg = computeSeasonAggregates(season.results);

  const metrics: {
    label: string;
    value: number;
    band: { min: number; max: number };
  }[] = [
    {
      label: "plays/game",
      value: agg.playsPerGame,
      band: NFL_BANDS.playsPerGame,
    },
    {
      label: "pass %",
      value: agg.passPercentage,
      band: NFL_BANDS.passPercentage,
    },
    {
      label: "rush %",
      value: agg.rushPercentage,
      band: NFL_BANDS.rushPercentage,
    },
    {
      label: "completion %",
      value: agg.completionPercentage,
      band: NFL_BANDS.completionPercentage,
    },
    {
      label: "yards/attempt",
      value: agg.yardsPerAttempt,
      band: NFL_BANDS.yardsPerAttempt,
    },
    {
      label: "yards/carry",
      value: agg.yardsPerCarry,
      band: NFL_BANDS.yardsPerCarry,
    },
    {
      label: "sacks/team/game",
      value: agg.sacksPerTeamPerGame,
      band: NFL_BANDS.sacksPerTeamPerGame,
    },
    {
      label: "TO/team/game",
      value: agg.turnoversPerTeamPerGame,
      band: NFL_BANDS.turnoversPerTeamPerGame,
    },
  ];

  let inBand = 0;
  for (const m of metrics) {
    const status = m.value >= m.band.min && m.value <= m.band.max
      ? "OK"
      : "MISS";
    if (status === "OK") inBand++;
    console.log(
      `  [${status}] ${m.label}: ${
        m.value.toFixed(2)
      } [${m.band.min}–${m.band.max}]`,
    );
  }
  console.log(`  ${inBand}/${metrics.length} metrics inside NFL bands`);

  assertGreater(season.results.length, 0);
});
