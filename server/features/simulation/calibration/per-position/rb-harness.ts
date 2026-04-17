import { deriveGameSeed } from "../../rng.ts";
import { CALIBRATION_GAME_COUNT } from "../constants.ts";
import { generateMatchups } from "../harness.ts";
import type { SimulateFn } from "../harness.ts";
import type { CalibrationLeague } from "../generate-calibration-league.ts";
import { collectRbSamples, type RbGameSample } from "./rb-sample.ts";
import { bucketByAttr, type BucketReport } from "./bucket-by-attr.ts";
import { type BandCheckResult, checkBand } from "./band-check.ts";
import { loadPositionBands, type PositionBands } from "./band-loader.ts";

// Headline RB metrics. YPC + per-game yardage cover the bulk of NFL
// RB production, TD rate captures the red-zone finishing piece, and
// fumble rate surfaces ball-security regressions. Receiving production
// is intentionally left out of this slice — the sim attributes catches
// to WR/TE, not RB, so it belongs in the WR harness.
export const RB_METRICS = [
  "yards_per_carry",
  "rush_td_rate",
  "yards_per_game",
  "fumble_rate",
] as const;

export type RbMetric = typeof RB_METRICS[number];

const METRIC_EXTRACTORS: Record<RbMetric, (s: RbGameSample) => number> = {
  yards_per_carry: (s) => s.yards_per_carry,
  rush_td_rate: (s) => s.rush_td_rate,
  yards_per_game: (s) => s.yards_per_game,
  fumble_rate: (s) => s.fumble_rate,
};

export interface RbCalibrationOptions {
  bandJson: string;
  league: CalibrationLeague;
  simulate: SimulateFn;
  gameCount?: number;
  // Minimum samples per bucket before we trust a band check. Under
  // this count we still emit the summary but flag it as under-sampled
  // so the report distinguishes "bucket is empty/noisy" from "bucket
  // is calibrated wrong".
  minSamplesPerBucket?: number;
}

export interface RbBucketReport {
  bucketLabel: string;
  bucketCenter: number;
  samples: number;
  underSampled: boolean;
  checks: BandCheckResult[];
}

export interface RbCalibrationReport {
  totalGames: number;
  totalSamples: number;
  bands: PositionBands;
  buckets: RbBucketReport[];
  failures: BandCheckResult[];
  passed: boolean;
}

const DEFAULT_MIN_SAMPLES = 50;

export function runRbCalibration(
  options: RbCalibrationOptions,
): RbCalibrationReport {
  const {
    bandJson,
    league,
    simulate,
    gameCount = CALIBRATION_GAME_COUNT,
    minSamplesPerBucket = DEFAULT_MIN_SAMPLES,
  } = options;

  const bands = loadPositionBands(bandJson);
  const teamById = new Map(league.teams.map((t) => [t.teamId, t]));
  const matchups = generateMatchups(league.teams, gameCount);

  const samples: RbGameSample[] = [];

  for (let i = 0; i < matchups.length; i++) {
    const { home, away } = matchups[i];
    const gameId = `rb-calibration-game-${i}`;
    const seed = deriveGameSeed(league.calibrationSeed, gameId);

    const result = simulate({ home, away, seed, gameId });
    const gameSamples = collectRbSamples({
      game: result,
      home: teamById.get(home.teamId) ?? home,
      away: teamById.get(away.teamId) ?? away,
    });
    samples.push(...gameSamples);
  }

  const bucketReports: BucketReport<RbGameSample>[] = bucketByAttr({
    samples,
    attr: (s) => s.rbOverall,
    metrics: METRIC_EXTRACTORS,
  });

  const buckets: RbBucketReport[] = bucketReports.map((report) => {
    const underSampled = report.samples.length < minSamplesPerBucket;
    const checks: BandCheckResult[] = RB_METRICS.flatMap((metric) => {
      // Don't emit band checks on under-sampled buckets — the NFL band
      // comparison would be dominated by sampling noise and drown out
      // the real failures from the populated buckets.
      if (underSampled) return [];
      return [
        checkBand({
          bucketLabel: report.bucket.label,
          metricName: metric,
          simSummary: report.metrics[metric],
          bands,
        }),
      ];
    });
    return {
      bucketLabel: report.bucket.label,
      bucketCenter: report.bucket.center,
      samples: report.samples.length,
      underSampled,
      checks,
    };
  });

  const failures = buckets.flatMap((b) => b.checks.filter((c) => !c.passed));

  return {
    totalGames: matchups.length,
    totalSamples: samples.length,
    bands,
    buckets,
    failures,
    passed: failures.length === 0,
  };
}

export function formatRbCalibrationReport(report: RbCalibrationReport): string {
  const lines: string[] = [];
  lines.push(
    `RB calibration — ${report.totalGames} games, ${report.totalSamples} RB-games`,
  );
  lines.push(
    `Bands: ${report.bands.position} / ${
      report.bands.seasons.join("-")
    } / ranked by ${report.bands.rankingStat}`,
  );
  lines.push("");
  for (const bucket of report.buckets) {
    const header = `[bucket ${bucket.bucketLabel}] n=${bucket.samples}` +
      (bucket.underSampled ? " (under-sampled, skipping band checks)" : "");
    lines.push(header);
    for (const check of bucket.checks) {
      const verdict = check.passed ? "PASS" : "FAIL";
      const dir = check.passed ? "" : ` (${check.direction})`;
      lines.push(
        `  ${verdict} ${check.metricName.padEnd(20)} ` +
          `sim=${check.simMean.toFixed(4)}  ` +
          `band(${check.expectedBand})=${check.bandMean.toFixed(4)}±${
            check.bandSd.toFixed(4)
          }  ` +
          `z=${check.zScore.toFixed(2)}  actual=${check.actualBand}${dir}`,
      );
    }
    lines.push("");
  }
  const passed = report.passed ? "PASS" : "FAIL";
  lines.push(
    `${passed}: ${report.failures.length} band check(s) missed expected band`,
  );
  return lines.join("\n");
}
