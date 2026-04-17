/**
 * CLI entry point for `deno task sim:refit`.
 *
 * 1. Runs a seed sweep with the score observer installed to measure the
 *    blockScore / protectionScore / coverageScore distributions.
 * 2. Loads the NFL bands from data/bands/team-game.json.
 * 3. Feeds both to the fit-outcomes pipeline.
 * 4. Writes the measured distribution and fitted coefficients to
 *    checked-in JSON artifacts alongside this file.
 *
 * The artifacts are regenerable and intended to be committed so CI can
 * enforce agreement between the fitter and the on-disk constants (PR 4).
 * In PR 1 the artifacts are produced but not yet consumed by resolve-play.
 */
import { CALIBRATION_SEEDS } from "./calibration-seeds.ts";
import { loadBands } from "./band-loader.ts";
import { fitOutcomes } from "./fit-outcomes.ts";
import { measureScores } from "./measure-scores.ts";

const BANDS_PATH = new URL(
  "../../../../data/bands/team-game.json",
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

export interface RunRefitOptions {
  measuredPath?: URL;
  coefficientsPath?: URL;
}

export interface RefitResult {
  measuredJson: string;
  coefficientsJson: string;
}

/**
 * Runs the measure → load bands → fit pipeline and returns the serialized
 * outputs. Pure enough to be covered by tests without write permissions;
 * the CLI wrapper below handles the actual file writes.
 */
export async function computeRefit(): Promise<RefitResult> {
  const measured = measureScores({ seeds: [...CALIBRATION_SEEDS] });
  const bandsJson = await Deno.readTextFile(BANDS_PATH);
  const bands = loadBands(bandsJson);
  const coefficients = fitOutcomes({ scores: measured, bands });

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
