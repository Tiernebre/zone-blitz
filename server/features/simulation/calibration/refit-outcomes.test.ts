import { assert, assertEquals } from "@std/assert";
import { computeRefit } from "./refit-outcomes.ts";

Deno.test("computeRefit is deterministic across invocations in the same process", async () => {
  const first = await computeRefit();
  const second = await computeRefit();

  // Within a single process the JSON modules and the simulator are
  // identical across calls, so two refits must yield byte-identical
  // output. Drift here signals non-determinism leaking into the
  // simulation pipeline or the fitter.
  assertEquals(first.measuredJson, second.measuredJson);
  assertEquals(first.coefficientsJson, second.coefficientsJson);
});

Deno.test("computeRefit produces well-formed JSON", async () => {
  const result = await computeRefit();
  const measured = JSON.parse(result.measuredJson);
  const coefficients = JSON.parse(result.coefficientsJson);

  assert(Array.isArray(measured.seeds) && measured.seeds.length > 0);
  assertEquals(typeof measured.blockScore.mean, "number");
  assertEquals(typeof coefficients.pass.completion.intercept, "number");
  assertEquals(typeof coefficients.pass.completion.slope, "number");
  assertEquals(typeof coefficients.run.yardageIntercept, "number");
});
