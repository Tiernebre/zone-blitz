import { generateCalibrationLeague } from "./generate-calibration-league.ts";
import { CALIBRATION_SEED } from "./calibration-seed.ts";

// Primary fixture keeps the original filename so run-calibration.ts
// and any external consumers continue to resolve it without change.
// Companion fixtures seeded differently let us run the harness
// against multiple independent draws when we want to confirm a
// tuning change holds up beyond a single seed.
const SEEDS: { seed: number; fileName: string }[] = [
  { seed: CALIBRATION_SEED, fileName: "calibration-league.json" },
  { seed: 0xA11CE_11, fileName: "calibration-league-a11ce11.json" },
  { seed: 0xDEADBEEF, fileName: "calibration-league-deadbeef.json" },
];

for (const { seed, fileName } of SEEDS) {
  const league = generateCalibrationLeague({ seed });
  const json = JSON.stringify(league, null, 2);
  const outPath = new URL(`./fixtures/${fileName}`, import.meta.url);
  await Deno.writeTextFile(outPath, json + "\n");
  console.log(
    `Wrote calibration league fixture (${league.teams.length} teams, seed=0x${
      seed.toString(16)
    }) to ${outPath.pathname}`,
  );
}
