/**
 * CLI entry point for `deno task sim:verify`.
 *
 * Runs the `computeRefit` pipeline and compares the freshly-computed
 * coefficients against the checked-in `outcome-coefficients.json`. Fails
 * with a readable diff if any coefficient has drifted beyond tolerance.
 *
 * Because the simulator consumes the artifact it produces (coefficients
 * are loaded via JSON import at module load time), running `sim:refit`
 * from the CLI is a fixed-point iteration that only converges to float
 * precision. The verification therefore uses tolerance comparisons
 * tuned to the quantities involved rather than strict byte equality —
 * tight enough to catch real drift (e.g., a forgotten sim change), loose
 * enough to accept sub-ε numerical wobble in the feedback loop.
 *
 * The `measured-scores.json` file is generated but intentionally not
 * verified against a fresh sim run: it describes the sim's trajectory
 * under the current coefficients, which drifts micrometrically across
 * runs and is not a reproducibility target on its own.
 */
import { computeRefit } from "./refit-outcomes.ts";
import type {
  FittedCoefficients,
  SigmoidCoefficients,
} from "./fit-outcomes.ts";

const COEFFICIENTS_PATH = new URL(
  "./outcome-coefficients.json",
  import.meta.url,
);

export const DEFAULT_SIGMOID_INTERCEPT_TOLERANCE = 0.02;
export const DEFAULT_RUN_INTERCEPT_TOLERANCE = 0.05;
export const DEFAULT_RUN_STDDEV_TOLERANCE = 0.05;

export interface VerifyTolerances {
  sigmoidIntercept?: number;
  runIntercept?: number;
  runStddev?: number;
}

export interface Drift {
  path: string;
  diskValue: number | string;
  freshValue: number | string;
  delta?: number;
  tolerance?: number;
}

function approxEqual(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

function compareSigmoid(
  label: string,
  disk: SigmoidCoefficients,
  fresh: SigmoidCoefficients,
  tolerance: number,
  drift: Drift[],
): void {
  if (!approxEqual(disk.intercept, fresh.intercept, tolerance)) {
    drift.push({
      path: `pass.${label}.intercept`,
      diskValue: disk.intercept,
      freshValue: fresh.intercept,
      delta: Math.abs(disk.intercept - fresh.intercept),
      tolerance,
    });
  }
  if (disk.slope !== fresh.slope) {
    drift.push({
      path: `pass.${label}.slope`,
      diskValue: disk.slope,
      freshValue: fresh.slope,
    });
  }
}

export function diffCoefficients(
  disk: FittedCoefficients,
  fresh: FittedCoefficients,
  tolerances: VerifyTolerances = {},
): Drift[] {
  const sigTol = tolerances.sigmoidIntercept ??
    DEFAULT_SIGMOID_INTERCEPT_TOLERANCE;
  const interceptTol = tolerances.runIntercept ??
    DEFAULT_RUN_INTERCEPT_TOLERANCE;
  const stddevTol = tolerances.runStddev ?? DEFAULT_RUN_STDDEV_TOLERANCE;

  const drift: Drift[] = [];

  compareSigmoid("sack", disk.pass.sack, fresh.pass.sack, sigTol, drift);
  compareSigmoid(
    "completion",
    disk.pass.completion,
    fresh.pass.completion,
    sigTol,
    drift,
  );
  compareSigmoid(
    "interception",
    disk.pass.interception,
    fresh.pass.interception,
    sigTol,
    drift,
  );
  compareSigmoid(
    "bigPlay",
    disk.pass.bigPlay,
    fresh.pass.bigPlay,
    sigTol,
    drift,
  );

  if (
    !approxEqual(
      disk.run.yardageIntercept,
      fresh.run.yardageIntercept,
      interceptTol,
    )
  ) {
    drift.push({
      path: "run.yardageIntercept",
      diskValue: disk.run.yardageIntercept,
      freshValue: fresh.run.yardageIntercept,
      delta: Math.abs(disk.run.yardageIntercept - fresh.run.yardageIntercept),
      tolerance: interceptTol,
    });
  }
  if (
    !approxEqual(disk.run.yardageStddev, fresh.run.yardageStddev, stddevTol)
  ) {
    drift.push({
      path: "run.yardageStddev",
      diskValue: disk.run.yardageStddev,
      freshValue: fresh.run.yardageStddev,
      delta: Math.abs(disk.run.yardageStddev - fresh.run.yardageStddev),
      tolerance: stddevTol,
    });
  }
  for (
    const k of [
      "yardageSlope",
      "yardageMin",
      "yardageMax",
      "bigPlayCutoff",
      "fumbleRate",
    ] as const
  ) {
    if (disk.run[k] !== fresh.run[k]) {
      drift.push({
        path: `run.${k}`,
        diskValue: disk.run[k],
        freshValue: fresh.run[k],
      });
    }
  }

  return drift;
}

export function formatDrift(drift: Drift[]): string {
  if (drift.length === 0) return "Coefficients match the checked-in artifact.";
  const lines = ["Coefficient drift detected:"];
  for (const d of drift) {
    const tolStr = d.tolerance !== undefined
      ? ` (Δ=${d.delta!.toFixed(4)}, tolerance=${d.tolerance})`
      : " (exact match required)";
    lines.push(
      `  ${d.path}: disk=${d.diskValue} fresh=${d.freshValue}${tolStr}`,
    );
  }
  lines.push(
    "\nRun `deno task sim:refit` to regenerate the coefficient artifact, then commit the result.",
  );
  return lines.join("\n");
}

export async function runVerify(
  tolerances: VerifyTolerances = {},
): Promise<Drift[]> {
  const diskJson = await Deno.readTextFile(COEFFICIENTS_PATH);
  const disk = JSON.parse(diskJson) as FittedCoefficients;
  const fresh = JSON.parse(
    (await computeRefit()).coefficientsJson,
  ) as FittedCoefficients;
  return diffCoefficients(disk, fresh, tolerances);
}

if (import.meta.main) {
  const drift = await runVerify();
  console.log(formatDrift(drift));
  if (drift.length > 0) {
    Deno.exit(1);
  }
}
