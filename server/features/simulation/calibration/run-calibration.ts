import { runCalibration } from "./harness.ts";
import { formatReport } from "./format-report.ts";
import { simulateGame } from "../simulate-game.ts";
import type { CalibrationLeague } from "./generate-calibration-league.ts";

// Run calibration across every fixture in ./fixtures. Any single
// fixture that fails fails the whole task. One-seed runs let a
// tuning pass that's overfit to one rng path silently hide real
// drift on every other draw — multi-seed forces honesty.
const bandPath = new URL(
  "../../../../data/bands/team-game.json",
  import.meta.url,
);
const fixturesDir = new URL("./fixtures/", import.meta.url);

const bandJson = await Deno.readTextFile(bandPath);

const fixtureFiles: string[] = [];
for await (const entry of Deno.readDir(fixturesDir)) {
  if (entry.isFile && entry.name.endsWith(".json")) {
    fixtureFiles.push(entry.name);
  }
}
fixtureFiles.sort();

if (fixtureFiles.length === 0) {
  console.error(`No calibration fixtures found under ${fixturesDir.pathname}`);
  Deno.exit(2);
}

let allPassed = true;
const summary: { fixture: string; passed: number; total: number }[] = [];

for (const fileName of fixtureFiles) {
  const fixtureJson = await Deno.readTextFile(
    new URL(fileName, fixturesDir),
  );
  const league: CalibrationLeague = JSON.parse(fixtureJson);

  const report = runCalibration({
    bandJson,
    league,
    simulate: simulateGame,
  });

  console.log(
    `=== ${fileName} (seed=0x${league.calibrationSeed.toString(16)}) ===`,
  );
  console.log(formatReport(report));
  console.log("");

  const passCount = report.results.length - report.failures.length;
  summary.push({
    fixture: fileName,
    passed: passCount,
    total: report.results.length,
  });
  if (!report.passed) allPassed = false;
}

console.log("=== Multi-seed summary ===");
for (const row of summary) {
  const status = row.passed === row.total ? "PASS" : "FAIL";
  console.log(`${status} ${row.fixture}: ${row.passed}/${row.total}`);
}

if (!allPassed) {
  Deno.exit(1);
}
