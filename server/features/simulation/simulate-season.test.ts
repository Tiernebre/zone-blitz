import { assertEquals, assertGreater, assertLessOrEqual } from "@std/assert";
import { simulateSeason } from "./simulate-season.ts";
import { computeSeasonAggregates } from "./season-aggregates.ts";

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
  playsPerGame: { min: 110, max: 160 },
  passPercentage: { min: 45, max: 70 },
  rushPercentage: { min: 30, max: 55 },
  completionPercentage: { min: 55, max: 85 },
  yardsPerAttempt: { min: 3.5, max: 10.0 },
  yardsPerCarry: { min: 2.5, max: 6.0 },
  sacksPerTeamPerGame: { min: 0.3, max: 5.0 },
  turnoversPerTeamPerGame: { min: 0.2, max: 3.0 },
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
