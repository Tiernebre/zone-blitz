import { assertGreater, assertLessOrEqual } from "@std/assert";
import { seedSweep } from "./seed-sweep.ts";

Deno.test("seedSweep reports mean and stddev across seeds", () => {
  const result = seedSweep([1, 2, 3], { teamCount: 8, gamesPerTeam: 7 });

  assertGreater(result.playsPerGame.mean, 0);
  assertGreater(result.playsPerGame.stddev, -1);
  assertLessOrEqual(result.playsPerGame.min, result.playsPerGame.max);

  assertGreater(result.passPercentage.mean, 0);
  assertGreater(result.rushPercentage.mean, 0);
  assertGreater(result.completionPercentage.mean, 0);
  assertGreater(result.yardsPerAttempt.mean, 0);
  assertGreater(result.yardsPerCarry.mean, 0);
  assertGreater(result.averageElapsedMs, 0);
});

Deno.test("seedSweep runs across all requested seeds", () => {
  const seeds = [10, 20, 30, 40, 50];
  const result = seedSweep(seeds, { teamCount: 4, gamesPerTeam: 3 });
  assertGreater(result.seeds.length, 4);
});

Deno.test("seedSweep band means are in plausible ranges", () => {
  const result = seedSweep([100, 200], { teamCount: 8, gamesPerTeam: 7 });

  assertGreater(result.playsPerGame.mean, 80);
  assertLessOrEqual(result.playsPerGame.mean, 200);

  assertGreater(result.passPercentage.mean, 30);
  assertLessOrEqual(result.passPercentage.mean, 80);

  assertGreater(result.completionPercentage.mean, 40);
  assertLessOrEqual(result.completionPercentage.mean, 90);
});
