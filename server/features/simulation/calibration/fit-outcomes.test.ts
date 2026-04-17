import {
  assert,
  assertAlmostEquals,
  assertEquals,
  assertThrows,
} from "@std/assert";
import { loadBands, type MetricBand } from "./band-loader.ts";
import { fitOutcomes, type ScoreDistribution } from "./fit-outcomes.ts";
import {
  parsePassingBigPlayRate,
  parseRushingOverall,
} from "./refit-outcomes.ts";

const BANDS_PATH = new URL(
  "../../../../data/bands/team-game.json",
  import.meta.url,
);
const RUSHING_PATH = new URL(
  "../../../../data/bands/rushing-plays.json",
  import.meta.url,
);
const PASSING_PATH = new URL(
  "../../../../data/bands/passing-plays.json",
  import.meta.url,
);
const MEASURED_PATH = new URL("./measured-scores.json", import.meta.url);
const ARTIFACT_PATH = new URL("./outcome-coefficients.json", import.meta.url);

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

async function loadMeasured(): Promise<ScoreDistribution> {
  const raw = JSON.parse(await Deno.readTextFile(MEASURED_PATH));
  return {
    blockScore: raw.blockScore,
    protectionScore: raw.protectionScore,
    coverageScore: raw.coverageScore,
  };
}

async function loadFixture() {
  const [scores, bandsJson, rushingJson, passingJson] = await Promise.all([
    loadMeasured(),
    Deno.readTextFile(BANDS_PATH),
    Deno.readTextFile(RUSHING_PATH),
    Deno.readTextFile(PASSING_PATH),
  ]);
  return {
    scores,
    bands: loadBands(bandsJson),
    rushingOverall: parseRushingOverall(rushingJson),
    passingBigPlayRate: parsePassingBigPlayRate(passingJson),
  };
}

Deno.test("fitOutcomes output matches the checked-in outcome-coefficients.json artifact", async () => {
  const input = await loadFixture();
  const fitted = fitOutcomes(input);
  const artifact = JSON.parse(await Deno.readTextFile(ARTIFACT_PATH));

  assertEquals(fitted.pass, artifact.pass);
  assertEquals(fitted.run, artifact.run);
});

Deno.test("sigmoid pass probabilities hit NFL target rates at measured score means", async () => {
  const input = await loadFixture();
  const fitted = fitOutcomes(input);

  const passAttempts = input.bands.get("pass_attempts")!.mean;
  const sacks = input.bands.get("sacks_taken")!.mean;
  const completionPct = input.bands.get("completion_pct")!.mean;
  const interceptions = input.bands.get("interceptions")!.mean;
  const passCalls = passAttempts + sacks;

  const sackAtMean = sigmoid(
    fitted.pass.sack.intercept +
      fitted.pass.sack.slope * input.scores.protectionScore.mean,
  );
  const completionAtMean = sigmoid(
    fitted.pass.completion.intercept +
      fitted.pass.completion.slope * input.scores.coverageScore.mean,
  );
  const interceptionAtMean = sigmoid(
    fitted.pass.interception.intercept +
      fitted.pass.interception.slope * input.scores.coverageScore.mean,
  );
  const bigPlayAtMean = sigmoid(
    fitted.pass.bigPlay.intercept +
      fitted.pass.bigPlay.slope * input.scores.coverageScore.mean,
  );

  assertAlmostEquals(sackAtMean, sacks / passCalls, 1e-4);
  assertAlmostEquals(completionAtMean, completionPct, 1e-4);
  assertAlmostEquals(interceptionAtMean, interceptions / passAttempts, 1e-4);
  assertAlmostEquals(bigPlayAtMean, input.passingBigPlayRate, 1e-4);
});

Deno.test("sigmoid slopes are monotonic in the expected direction", async () => {
  const input = await loadFixture();
  const fitted = fitOutcomes(input);

  // Better protection → lower sack rate.
  assert(fitted.pass.sack.slope < 0);
  // Better offensive route edge → higher completion, lower INT.
  assert(fitted.pass.completion.slope > 0);
  assert(fitted.pass.interception.slope < 0);
  // Better offensive route edge → higher big-play rate among completions.
  assert(fitted.pass.bigPlay.slope > 0);
});

Deno.test("sigmoid probabilities stay in (0,1) across a wide score range", async () => {
  const input = await loadFixture();
  const fitted = fitOutcomes(input);

  for (const score of [-50, -20, 0, 20, 50]) {
    const sack = sigmoid(
      fitted.pass.sack.intercept + fitted.pass.sack.slope * score,
    );
    const comp = sigmoid(
      fitted.pass.completion.intercept + fitted.pass.completion.slope * score,
    );
    const int_ = sigmoid(
      fitted.pass.interception.intercept +
        fitted.pass.interception.slope * score,
    );
    const big = sigmoid(
      fitted.pass.bigPlay.intercept + fitted.pass.bigPlay.slope * score,
    );
    for (const p of [sack, comp, int_, big]) {
      assert(p > 0 && p < 1, `probability ${p} out of (0,1) at score=${score}`);
    }
  }
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

  const totalVariance = fitted.run.yardageSlope ** 2 *
      input.scores.blockScore.stddev ** 2 +
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
    () =>
      fitOutcomes({
        scores,
        bands: new Map(),
        rushingOverall: dummyBand,
        passingBigPlayRate: 0.14,
      }),
    Error,
    "non-empty bands map",
  );
});

Deno.test("fitOutcomes rejects out-of-range passingBigPlayRate", async () => {
  const input = await loadFixture();
  assertThrows(
    () => fitOutcomes({ ...input, passingBigPlayRate: 0 }),
    Error,
    "passingBigPlayRate",
  );
  assertThrows(
    () => fitOutcomes({ ...input, passingBigPlayRate: 1.5 }),
    Error,
    "passingBigPlayRate",
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

Deno.test("parsePassingBigPlayRate rejects malformed passing-plays JSON", () => {
  assertThrows(() => parsePassingBigPlayRate("{}"), Error);
  assertThrows(
    () =>
      parsePassingBigPlayRate(
        JSON.stringify({
          bands: { big_play_rate: { twenty_plus_per_completion: { rate: 2 } } },
        }),
      ),
    Error,
  );
});
