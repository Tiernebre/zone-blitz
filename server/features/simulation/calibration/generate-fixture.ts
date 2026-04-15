import { generateCalibrationLeague } from "./generate-calibration-league.ts";

const league = generateCalibrationLeague();
const json = JSON.stringify(league, null, 2);

const outPath = new URL("./fixtures/calibration-league.json", import.meta.url);
await Deno.writeTextFile(outPath, json + "\n");

console.log(
  `Wrote calibration league fixture (${league.teams.length} teams) to ${outPath.pathname}`,
);
