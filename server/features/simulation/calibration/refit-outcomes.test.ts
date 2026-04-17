import { assert, assertEquals } from "@std/assert";
import { computeRefit } from "./refit-outcomes.ts";

const MEASURED_PATH = new URL("./measured-scores.json", import.meta.url);
const COEFFICIENTS_PATH = new URL(
  "./outcome-coefficients.json",
  import.meta.url,
);

Deno.test("computeRefit reproduces the checked-in artifacts byte-for-byte", async () => {
  const diskMeasured = await Deno.readTextFile(MEASURED_PATH);
  const diskCoefficients = await Deno.readTextFile(COEFFICIENTS_PATH);

  const result = await computeRefit();

  assertEquals(result.measuredJson, diskMeasured);
  assertEquals(result.coefficientsJson, diskCoefficients);
});

Deno.test("computeRefit produces well-formed JSON", async () => {
  const result = await computeRefit();
  const measured = JSON.parse(result.measuredJson);
  const coefficients = JSON.parse(result.coefficientsJson);

  assert(Array.isArray(measured.seeds) && measured.seeds.length > 0);
  assertEquals(typeof measured.blockScore.mean, "number");
  assertEquals(typeof coefficients.pass.completion.base, "number");
  assertEquals(typeof coefficients.run.yardageIntercept, "number");
});
