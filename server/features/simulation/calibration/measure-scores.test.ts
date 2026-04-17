import { assert, assertEquals } from "@std/assert";
import { CALIBRATION_SEED } from "./calibration-seed.ts";
import { measureScores, summarizeSamples } from "./measure-scores.ts";

Deno.test("summarizeSamples returns zeroed stats for empty samples", () => {
  const summary = summarizeSamples({
    blockScore: [],
    protectionScore: [],
    coverageScore: [],
  });
  assertEquals(summary, {
    blockScore: { mean: 0, stddev: 0 },
    protectionScore: { mean: 0, stddev: 0 },
    coverageScore: { mean: 0, stddev: 0 },
  });
});

Deno.test("summarizeSamples computes mean and population stddev", () => {
  const summary = summarizeSamples({
    blockScore: [2, 4, 4, 4, 5, 5, 7, 9],
    protectionScore: [1, 1, 1, 1],
    coverageScore: [0, 10],
  });
  assertEquals(summary.blockScore.mean, 5);
  assertEquals(summary.blockScore.stddev, 2);
  assertEquals(summary.protectionScore, { mean: 1, stddev: 0 });
  assertEquals(summary.coverageScore, { mean: 5, stddev: 5 });
});

Deno.test("measureScores runs the simulator and produces non-empty distributions", () => {
  // A small gamesPerSeed proves the wiring without a ~20s full sweep.
  const measured = measureScores({
    seeds: [CALIBRATION_SEED],
    gamesPerSeed: 32,
  });
  assertEquals(measured.seeds, [CALIBRATION_SEED]);
  assert(measured.sampleCounts.blockScore > 0);
  assert(measured.sampleCounts.protectionScore > 0);
  assert(measured.sampleCounts.coverageScore > 0);
  assert(Number.isFinite(measured.blockScore.mean));
  assert(Number.isFinite(measured.blockScore.stddev));
  assert(measured.blockScore.stddev > 0);
  assert(measured.protectionScore.stddev > 0);
  assert(measured.coverageScore.stddev > 0);
});
