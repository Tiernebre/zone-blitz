import { simulateGame } from "../../simulate-game.ts";
import { generateCalibrationLeague } from "../generate-calibration-league.ts";
import { CALIBRATION_SEEDS } from "../calibration-seeds.ts";
import { formatOtCalibrationReport, runOtCalibration } from "./ot-harness.ts";

// Per-issue-#496: this entry point is intentionally report-only at
// first. We print per-bucket PASS/FAIL against NFL OT percentile
// bands across every calibration seed so a human can eyeball the
// signal — gating will come later once we understand noise
// characteristics per bucket.
//
// IMPORTANT: the underlying NFL bands are PROXY METRICS v1 (nflreadr
// does not carry PFF block grades). Large numbers of failures are
// expected here and do not necessarily indicate a sim bug — they
// reflect the limited fidelity of team-level protection proxies.
const bandPath = new URL(
  "../../../../../data/bands/per-position/ot.json",
  import.meta.url,
);

const bandJson = await Deno.readTextFile(bandPath);

let allPassed = true;
const summary: {
  seed: number;
  passed: number;
  total: number;
  underSampled: number;
}[] = [];

for (const seed of CALIBRATION_SEEDS) {
  const league = generateCalibrationLeague({ seed });
  const report = runOtCalibration({
    bandJson,
    league,
    simulate: simulateGame,
  });

  console.log(`=== seed=0x${seed.toString(16)} ===`);
  console.log(formatOtCalibrationReport(report));
  console.log("");

  const totalChecks = report.buckets.reduce(
    (sum, b) => sum + b.checks.length,
    0,
  );
  const passCount = totalChecks - report.failures.length;
  const underSampled = report.buckets.filter((b) => b.underSampled).length;
  summary.push({ seed, passed: passCount, total: totalChecks, underSampled });
  if (!report.passed) allPassed = false;
}

console.log("=== Multi-seed summary ===");
for (const row of summary) {
  const status = row.passed === row.total ? "PASS" : "FAIL";
  const underSampledNote = row.underSampled > 0
    ? ` (${row.underSampled} bucket(s) under-sampled)`
    : "";
  console.log(
    `${status} seed=0x${
      row.seed.toString(16)
    }: ${row.passed}/${row.total}${underSampledNote}`,
  );
}

if (!allPassed) {
  // Report-only for now: do not exit non-zero so CI users can observe
  // the expected proxy-metric failures without the task breaking.
  console.log(
    "(report-only: proxy metric failures are expected; not exiting non-zero)",
  );
}
