import {
  assert,
  assertAlmostEquals,
  assertEquals,
  assertThrows,
} from "@std/assert";
import { loadBands, type MetricBand } from "./band-loader.ts";
import { fitOutcomes, type ScoreDistribution } from "./fit-outcomes.ts";
import { parseRushingOverall } from "./refit-outcomes.ts";

const BANDS_PATH = new URL(
  "../../../../data/bands/team-game.json",
  import.meta.url,
);
const RUSHING_PATH = new URL(
  "../../../../data/bands/rushing-plays.json",
  import.meta.url,
);
const MEASURED_PATH = new URL("./measured-scores.json", import.meta.url);
const ARTIFACT_PATH = new URL("./outcome-coefficients.json", import.meta.url);

async function loadMeasured(): Promise<ScoreDistribution> {
  const raw = JSON.parse(await Deno.readTextFile(MEASURED_PATH));
  return {
    blockScore: raw.blockScore,
    protectionScore: raw.protectionScore,
    coverageScore: raw.coverageScore,
  };
}

async function loadFixture() {
  const [scores, bandsJson, rushingJson] = await Promise.all([
    loadMeasured(),
    Deno.readTextFile(BANDS_PATH),
    Deno.readTextFile(RUSHING_PATH),
  ]);
  return {
    scores,
    bands: loadBands(bandsJson),
    rushingOverall: parseRushingOverall(rushingJson),
  };
}

Deno.test("fitOutcomes output matches the checked-in outcome-coefficients.json artifact", async () => {
  const input = await loadFixture();
  const fitted = fitOutcomes(input);
  const artifact = JSON.parse(await Deno.readTextFile(ARTIFACT_PATH));

  assertEquals(fitted.pass, artifact.pass);
  assertEquals(fitted.run, artifact.run);
});

Deno.test("continuous run yardage model hits the NFL rushing mean by construction", async () => {
  const input = await loadFixture();
  const fitted = fitOutcomes(input);

  const predictedMean = fitted.run.yardageIntercept +
    fitted.run.yardageSlope * input.scores.blockScore.mean;
  assertAlmostEquals(predictedMean, input.rushingOverall.mean, 1e-3);
});

Deno.test("continuous run yardage model reproduces the NFL rushing variance", async () => {
  const input = await loadFixture();
  const fitted = fitOutcomes(input);

  const totalVariance =
    fitted.run.yardageSlope ** 2 * input.scores.blockScore.stddev ** 2 +
    fitted.run.yardageStddev ** 2;
  const targetVariance = input.rushingOverall.sd ** 2;
  assertAlmostEquals(totalVariance, targetVariance, 1e-2);
});

Deno.test("run bigPlayCutoff matches the NFL rushing p90", async () => {
  const input = await loadFixture();
  const fitted = fitOutcomes(input);
  assertEquals(fitted.run.bigPlayCutoff, input.rushingOverall.p90);
});

Deno.test("run yardage slope is strictly positive (monotonic in blockScore)", async () => {
  const input = await loadFixture();
  const fitted = fitOutcomes(input);
  assert(fitted.run.yardageSlope > 0);
});

Deno.test("fitOutcomes throws when bands map is empty", () => {
  const scores: ScoreDistribution = {
    blockScore: { mean: 0, stddev: 1 },
    protectionScore: { mean: 0, stddev: 1 },
    coverageScore: { mean: 0, stddev: 1 },
  };
  const dummyBand: MetricBand = {
    n: 1,
    mean: 4,
    sd: 6,
    min: -10,
    p10: 0,
    p25: 1,
    p50: 3,
    p75: 6,
    p90: 10,
    max: 80,
  };
  assertThrows(
    () => fitOutcomes({ scores, bands: new Map(), rushingOverall: dummyBand }),
    Error,
    "non-empty bands map",
  );
});

Deno.test("parseRushingOverall rejects malformed rushing-plays JSON", () => {
  assertThrows(() => parseRushingOverall("{}"), Error, "missing bands.overall");
  assertThrows(
    () =>
      parseRushingOverall(JSON.stringify({ bands: { overall: { mean: 4 } } })),
    Error,
    "missing field",
  );
});
