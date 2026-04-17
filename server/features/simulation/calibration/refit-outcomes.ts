/**
 * CLI entry point for `deno task sim:refit`.
 *
 * 1. Runs a seed sweep of calibration leagues with the score observer
 *    installed to measure the blockScore / protectionScore /
 *    coverageScore distributions.
 * 2. Loads the NFL bands from data/bands/team-game.json, the per-rush
 *    overall band from data/bands/rushing-plays.json, and the per-
 *    completion 20+ yard rate from data/bands/passing-plays.json.
 * 3. Feeds all of the above to the fit-outcomes pipeline.
 * 4. Writes the measured distribution and fitted coefficients to
 *    checked-in JSON artifacts alongside this file.
 *
 * `computeRefit` is the pure pipeline (no filesystem writes) so tests
 * can exercise it without the `--allow-write` flag; `runRefit` is the
 * thin CLI wrapper that handles the actual file writes.
 *
 * ## When to run this
 *
 *   Any time the matchup-score distribution can shift:
 *   - Adjusting coaching-mod magnitudes, scheme-fit deltas, noise stddev
 *     in `resolve-play.ts::rollMatchup`.
 *   - Changing how matchups are assembled in `resolve-matchups.ts`.
 *   - Updating the calibration-league attribute profiles.
 *   - Updating an NFL band JSON under `data/bands/`.
 *
 *   Flow: edit sim → `deno task sim:refit` → `deno task sim:verify`
 *   (should pass without drift) → commit the updated
 *   `outcome-coefficients.json` + `measured-scores.json` with the sim
 *   change in the same PR. CI's `sim-verify` job fails the build if
 *   coefficients on disk disagree with a fresh refit beyond tolerance.
 */
import { CALIBRATION_SEEDS } from "./calibration-seeds.ts";
import { loadBands, type MetricBand } from "./band-loader.ts";
import { fitOutcomes } from "./fit-outcomes.ts";
import { measureScores } from "./measure-scores.ts";

const BANDS_PATH = new URL(
  "../../../../data/bands/team-game.json",
  import.meta.url,
);
const RUSHING_PATH = new URL(
  "../../../../data/bands/rushing-plays.json",
  import.meta.url,
);
const PASSING_PATH = new URL(
  "../../../../data/bands/passing-plays.json",
  import.meta.url,
);
const DEFAULT_MEASURED_PATH = new URL(
  "./measured-scores.json",
  import.meta.url,
);
const DEFAULT_COEFFICIENTS_PATH = new URL(
  "./outcome-coefficients.json",
  import.meta.url,
);

const REQUIRED_BAND_FIELDS: (keyof MetricBand)[] = [
  "n",
  "mean",
  "sd",
  "min",
  "p10",
  "p25",
  "p50",
  "p75",
  "p90",
  "max",
];

export function parseRushingOverall(jsonString: string): MetricBand {
  const parsed = JSON.parse(jsonString);
  const overall = parsed?.bands?.overall;
  if (!overall || typeof overall !== "object") {
    throw new Error("rushing-plays.json missing bands.overall");
  }
  for (const field of REQUIRED_BAND_FIELDS) {
    if (typeof overall[field] !== "number") {
      throw new Error(`rushing-plays overall band missing field "${field}"`);
    }
  }
  return overall as MetricBand;
}

export function parsePassingBigPlayRate(jsonString: string): number {
  const parsed = JSON.parse(jsonString);
  const rate = parsed?.bands?.big_play_rate?.twenty_plus_per_completion?.rate;
  if (typeof rate !== "number" || rate <= 0 || rate >= 1) {
    throw new Error(
      "passing-plays.json missing bands.big_play_rate.twenty_plus_per_completion.rate",
    );
  }
  return rate;
}

export interface RunRefitOptions {
  measuredPath?: URL;
  coefficientsPath?: URL;
}

export interface RefitResult {
  measuredJson: string;
  coefficientsJson: string;
}

export async function computeRefit(): Promise<RefitResult> {
  const measured = measureScores({ seeds: [...CALIBRATION_SEEDS] });
  const bandsJson = await Deno.readTextFile(BANDS_PATH);
  const rushingJson = await Deno.readTextFile(RUSHING_PATH);
  const passingJson = await Deno.readTextFile(PASSING_PATH);
  const bands = loadBands(bandsJson);
  const rushingOverall = parseRushingOverall(rushingJson);
  const passingBigPlayRate = parsePassingBigPlayRate(passingJson);

  const coefficients = fitOutcomes({
    scores: measured,
    bands,
    rushingOverall,
    passingBigPlayRate,
  });

  const measuredOut = {
    generated_by: "deno task sim:refit",
    seeds: measured.seeds,
    sampleCounts: measured.sampleCounts,
    blockScore: measured.blockScore,
    protectionScore: measured.protectionScore,
    coverageScore: measured.coverageScore,
  };

  return {
    measuredJson: JSON.stringify(measuredOut, null, 2) + "\n",
    coefficientsJson: JSON.stringify(
      { generated_by: "deno task sim:refit", ...coefficients },
      null,
      2,
    ) + "\n",
  };
}

export async function runRefit(options: RunRefitOptions = {}): Promise<void> {
  const measuredPath = options.measuredPath ?? DEFAULT_MEASURED_PATH;
  const coefficientsPath = options.coefficientsPath ??
    DEFAULT_COEFFICIENTS_PATH;

  const result = await computeRefit();
  await Deno.writeTextFile(measuredPath, result.measuredJson);
  await Deno.writeTextFile(coefficientsPath, result.coefficientsJson);

  console.log(`Wrote ${measuredPath.pathname}`);
  console.log(`Wrote ${coefficientsPath.pathname}`);
}

if (import.meta.main) {
  await runRefit();
}
