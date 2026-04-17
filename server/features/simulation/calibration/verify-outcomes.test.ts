import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import type { FittedCoefficients } from "./fit-outcomes.ts";
import { diffCoefficients, formatDrift, runVerify } from "./verify-outcomes.ts";

function makeCoefficients(): FittedCoefficients {
  return {
    pass: {
      sack: { intercept: -2.7, slope: -0.1 },
      completion: { intercept: 0.75, slope: 0.05 },
      interception: { intercept: -4.1, slope: -0.05 },
      bigPlay: { intercept: -1.6, slope: 0.04 },
      sackYards: { min: -10, max: -3 },
      completionYards: { min: 3, max: 15 },
      bigPlayYards: { min: 14, max: 35 },
      fumbleOnSack: 0.08,
    },
    run: {
      yardageIntercept: 5.3,
      yardageSlope: 0.25,
      yardageStddev: 5.9,
      yardageMin: -8,
      yardageMax: 60,
      bigPlayCutoff: 10,
      fumbleRate: 0.01,
    },
  };
}

Deno.test("diffCoefficients returns no drift when coefficients match", () => {
  const c = makeCoefficients();
  assertEquals(diffCoefficients(c, structuredClone(c)), []);
});

Deno.test("diffCoefficients ignores sub-tolerance sigmoid intercept drift", () => {
  const disk = makeCoefficients();
  const fresh = makeCoefficients();
  fresh.pass.sack.intercept = -2.71;
  assertEquals(diffCoefficients(disk, fresh), []);
});

Deno.test("diffCoefficients flags sigmoid intercept drift above tolerance", () => {
  const disk = makeCoefficients();
  const fresh = makeCoefficients();
  fresh.pass.sack.intercept = -2.5;
  const drift = diffCoefficients(disk, fresh);
  assertEquals(drift.length, 1);
  assertEquals(drift[0].path, "pass.sack.intercept");
  assert((drift[0].delta ?? 0) > 0);
});

Deno.test("diffCoefficients flags slope changes exactly (design knobs)", () => {
  const disk = makeCoefficients();
  const fresh = makeCoefficients();
  fresh.pass.completion.slope = 0.06;
  const drift = diffCoefficients(disk, fresh);
  assertEquals(drift[0].path, "pass.completion.slope");
  assertEquals(drift[0].tolerance, undefined);
});

Deno.test("diffCoefficients flags run intercept drift above tolerance", () => {
  const disk = makeCoefficients();
  const fresh = makeCoefficients();
  fresh.run.yardageIntercept = 5.4;
  const drift = diffCoefficients(disk, fresh);
  assertEquals(drift.length, 1);
  assertEquals(drift[0].path, "run.yardageIntercept");
});

Deno.test("diffCoefficients flags run stddev drift above tolerance", () => {
  const disk = makeCoefficients();
  const fresh = makeCoefficients();
  fresh.run.yardageStddev = 6.1;
  const drift = diffCoefficients(disk, fresh);
  assertEquals(drift.length, 1);
  assertEquals(drift[0].path, "run.yardageStddev");
});

Deno.test("diffCoefficients flags exact-only run fields when changed", () => {
  const disk = makeCoefficients();
  const fresh = makeCoefficients();
  fresh.run.bigPlayCutoff = 12;
  const drift = diffCoefficients(disk, fresh);
  assertEquals(drift.length, 1);
  assertEquals(drift[0].path, "run.bigPlayCutoff");
});

Deno.test("diffCoefficients honors caller-provided tolerances", () => {
  const disk = makeCoefficients();
  const fresh = makeCoefficients();
  fresh.pass.sack.intercept = -2.71;
  const drift = diffCoefficients(disk, fresh, { sigmoidIntercept: 0.001 });
  assertEquals(drift.length, 1);
});

Deno.test("formatDrift renders an empty list cleanly", () => {
  assertEquals(formatDrift([]), "Coefficients match the checked-in artifact.");
});

Deno.test("formatDrift renders drift entries with tolerance context", () => {
  const disk = makeCoefficients();
  const fresh = makeCoefficients();
  fresh.pass.sack.intercept = -2.5;
  fresh.run.bigPlayCutoff = 12;
  const report = formatDrift(diffCoefficients(disk, fresh));
  assertStringIncludes(report, "pass.sack.intercept");
  assertStringIncludes(report, "run.bigPlayCutoff");
  assertStringIncludes(report, "sim:refit");
});

Deno.test("runVerify against the committed artifact reports no drift", async () => {
  const drift = await runVerify();
  assertEquals(drift, []);
});
