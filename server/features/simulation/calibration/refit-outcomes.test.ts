import { assertEquals } from "@std/assert";
import { runRefit } from "./refit-outcomes.ts";

const MEASURED_PATH = new URL("./measured-scores.json", import.meta.url);
const COEFFICIENTS_PATH = new URL(
  "./outcome-coefficients.json",
  import.meta.url,
);

Deno.test("runRefit regenerates the checked-in artifacts deterministically", async () => {
  const beforeMeasured = await Deno.readTextFile(MEASURED_PATH);
  const beforeCoeffs = await Deno.readTextFile(COEFFICIENTS_PATH);

  await runRefit();

  const afterMeasured = await Deno.readTextFile(MEASURED_PATH);
  const afterCoeffs = await Deno.readTextFile(COEFFICIENTS_PATH);

  // Idempotent: rerunning the refit against the same code + bands must
  // reproduce the committed artifacts byte-for-byte. Drift here signals
  // either a sim-behavior change that wasn't accompanied by a re-commit of
  // these files, or non-determinism leaking into the pipeline.
  assertEquals(beforeMeasured, afterMeasured);
  assertEquals(beforeCoeffs, afterCoeffs);
});
