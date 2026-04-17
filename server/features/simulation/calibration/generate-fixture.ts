import { generateCalibrationLeague } from "./generate-calibration-league.ts";
import { CALIBRATION_SEED } from "./calibration-seed.ts";

// Emit a single anchor fixture purely as a human debugging aid —
// open it to inspect specific teams, starters, or scheme
// fingerprints. The calibration harness (run-calibration.ts) no
// longer reads this file; it generates every league in memory from
// CALIBRATION_SEEDS. That means regenerating the fixture is
// optional — the harness will always match the current generator.

const league = generateCalibrationLeague({ seed: CALIBRATION_SEED });
const json = JSON.stringify(league, null, 2);
const outPath = new URL(
  "./fixtures/calibration-league.json",
  import.meta.url,
);
await Deno.writeTextFile(outPath, json + "\n");

console.log(
  `Wrote anchor calibration fixture (${league.teams.length} teams, seed=0x${
    CALIBRATION_SEED.toString(16)
  }) to ${outPath.pathname}`,
);
