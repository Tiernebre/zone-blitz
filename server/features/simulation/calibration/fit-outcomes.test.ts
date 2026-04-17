import { assertEquals, assertThrows } from "@std/assert";
import { PASS_RESOLUTION, RUN_RESOLUTION } from "../resolve-play.ts";
import { loadBands } from "./band-loader.ts";
import { fitOutcomes, type ScoreDistribution } from "./fit-outcomes.ts";

const BANDS_PATH = new URL(
  "../../../../data/bands/team-game.json",
  import.meta.url,
);
const MEASURED_PATH = new URL("./measured-scores.json", import.meta.url);

async function loadMeasured(): Promise<ScoreDistribution> {
  const raw = JSON.parse(await Deno.readTextFile(MEASURED_PATH));
  return {
    blockScore: raw.blockScore,
    protectionScore: raw.protectionScore,
    coverageScore: raw.coverageScore,
  };
}

async function loadBandsFromDisk() {
  return loadBands(await Deno.readTextFile(BANDS_PATH));
}

Deno.test("fitOutcomes reproduces PASS_RESOLUTION constants from current distribution", async () => {
  const scores = await loadMeasured();
  const bands = await loadBandsFromDisk();

  const fitted = fitOutcomes({ scores, bands });

  assertEquals(fitted.pass.completion.base, PASS_RESOLUTION.completion.base);
  assertEquals(
    fitted.pass.completion.coverageModifier,
    PASS_RESOLUTION.completion.coverageModifier,
  );
  assertEquals(fitted.pass.completion.floor, PASS_RESOLUTION.completion.floor);
  assertEquals(
    fitted.pass.completion.ceiling,
    PASS_RESOLUTION.completion.ceiling,
  );

  assertEquals(
    fitted.pass.interception.base,
    PASS_RESOLUTION.interception.base,
  );
  assertEquals(
    fitted.pass.interception.coverageModifier,
    PASS_RESOLUTION.interception.coverageModifier,
  );
  assertEquals(
    fitted.pass.interception.floor,
    PASS_RESOLUTION.interception.floor,
  );

  assertEquals(fitted.pass.sack.base, PASS_RESOLUTION.sack.base);
  assertEquals(
    fitted.pass.sack.protectionModifier,
    PASS_RESOLUTION.sack.protectionModifier,
  );
  assertEquals(fitted.pass.sack.floor, PASS_RESOLUTION.sack.floor);

  assertEquals(fitted.pass.bigPlay.base, PASS_RESOLUTION.bigPlay.base);
  assertEquals(
    fitted.pass.bigPlay.coverageModifier,
    PASS_RESOLUTION.bigPlay.coverageModifier,
  );
  assertEquals(fitted.pass.bigPlay.floor, PASS_RESOLUTION.bigPlay.floor);
  assertEquals(fitted.pass.bigPlay.ceiling, PASS_RESOLUTION.bigPlay.ceiling);
  assertEquals(
    fitted.pass.bigPlay.yards.min,
    PASS_RESOLUTION.bigPlay.yards.min,
  );
  assertEquals(
    fitted.pass.bigPlay.yards.max,
    PASS_RESOLUTION.bigPlay.yards.max,
  );

  assertEquals(
    fitted.pass.completionYards.min,
    PASS_RESOLUTION.completionYards.min,
  );
  assertEquals(
    fitted.pass.completionYards.max,
    PASS_RESOLUTION.completionYards.max,
  );
  assertEquals(fitted.pass.fumbleOnSack, PASS_RESOLUTION.fumbleOnSack);
});

Deno.test("fitOutcomes reproduces RUN_RESOLUTION constants from current distribution", async () => {
  const scores = await loadMeasured();
  const bands = await loadBandsFromDisk();

  const fitted = fitOutcomes({ scores, bands });

  assertEquals(fitted.run.stuffThreshold, RUN_RESOLUTION.stuffThreshold);
  assertEquals(
    fitted.run.shortGainThreshold,
    RUN_RESOLUTION.shortGainThreshold,
  );
  assertEquals(fitted.run.bigPlayThreshold, RUN_RESOLUTION.bigPlayThreshold);
  assertEquals(fitted.run.stuffYards.min, RUN_RESOLUTION.stuffYards.min);
  assertEquals(fitted.run.stuffYards.max, RUN_RESOLUTION.stuffYards.max);
  assertEquals(
    fitted.run.shortGainYards.min,
    RUN_RESOLUTION.shortGainYards.min,
  );
  assertEquals(
    fitted.run.shortGainYards.max,
    RUN_RESOLUTION.shortGainYards.max,
  );
  assertEquals(fitted.run.bigPlayYards.min, RUN_RESOLUTION.bigPlayYards.min);
  assertEquals(fitted.run.bigPlayYards.max, RUN_RESOLUTION.bigPlayYards.max);
  assertEquals(fitted.run.normalYards.min, RUN_RESOLUTION.normalYards.min);
  assertEquals(fitted.run.normalYards.max, RUN_RESOLUTION.normalYards.max);
  assertEquals(fitted.run.fumbleRate, RUN_RESOLUTION.fumbleRate);
});

Deno.test("fitOutcomes matches the checked-in outcome-coefficients.json artifact", async () => {
  const scores = await loadMeasured();
  const bands = await loadBandsFromDisk();
  const fitted = fitOutcomes({ scores, bands });

  const artifactPath = new URL("./outcome-coefficients.json", import.meta.url);
  const artifact = JSON.parse(await Deno.readTextFile(artifactPath));

  assertEquals(fitted.pass, artifact.pass);
  assertEquals(fitted.run, artifact.run);
});

Deno.test("fitOutcomes throws when bands map is empty", () => {
  const scores: ScoreDistribution = {
    blockScore: { mean: 0, stddev: 1 },
    protectionScore: { mean: 0, stddev: 1 },
    coverageScore: { mean: 0, stddev: 1 },
  };
  assertThrows(
    () => fitOutcomes({ scores, bands: new Map() }),
    Error,
    "non-empty bands map",
  );
});
