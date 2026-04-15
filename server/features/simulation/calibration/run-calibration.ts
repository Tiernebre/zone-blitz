import { runCalibration } from "./harness.ts";
import { formatReport } from "./format-report.ts";
import { simulateGame } from "../simulate-game.ts";
import type { CalibrationLeague } from "./generate-calibration-league.ts";

const bandPath = new URL(
  "../../../../data/bands/team-game.json",
  import.meta.url,
);
const fixturePath = new URL(
  "./fixtures/calibration-league.json",
  import.meta.url,
);

const bandJson = await Deno.readTextFile(bandPath);
const fixtureJson = await Deno.readTextFile(fixturePath);
const league: CalibrationLeague = JSON.parse(fixtureJson);

const report = runCalibration({
  bandJson,
  league,
  simulate: simulateGame,
});

const output = formatReport(report);
console.log(output);

if (!report.passed) {
  Deno.exit(1);
}
