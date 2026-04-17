import { deriveGameSeed } from "../../rng.ts";
import { CALIBRATION_GAME_COUNT } from "../constants.ts";
import { generateMatchups } from "../harness.ts";
import type { SimulateFn } from "../harness.ts";
import type { CalibrationLeague } from "../generate-calibration-league.ts";
import { collectSSamples, type SGameSample } from "./s-sample.ts";
import { bucketByAttr, type BucketReport } from "./bucket-by-attr.ts";
import { type BandCheckResult, checkBand } from "./band-check.ts";
import { loadPositionBands, type PositionBands } from "./band-loader.ts";

// Headline S metrics. Tackles/game and PBU rate cover the box-support
// + underneath-coverage work, INT rate is the ball-hawking piece, and
// forced-fumble rate surfaces physicality at the catch point. Every
// metric is higher-is-better for a safety's defensive impact — there's
// no lower-is-better band in this slice (coverage-yield, which would
// be, isn't available in the per-player nflreadr feed).
export const S_METRICS = [
  "tackles_per_game",
  "int_rate",
  "pbu_rate",
  "forced_fumble_rate",
] as const;

export type SMetric = typeof S_METRICS[number];

const METRIC_EXTRACTORS: Record<SMetric, (s: SGameSample) => number> = {
  tackles_per_game: (s) => s.tackles_per_game,
  int_rate: (s) => s.int_rate,
  pbu_rate: (s) => s.pbu_rate,
  forced_fumble_rate: (s) => s.forced_fumble_rate,
};

export interface SCalibrationOptions {
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

export interface SBucketReport {
  bucketLabel: string;
  bucketCenter: number;
  samples: number;
  underSampled: boolean;
  checks: BandCheckResult[];
}

export interface SCalibrationReport {
  totalGames: number;
  totalSamples: number;
  bands: PositionBands;
  buckets: SBucketReport[];
  failures: BandCheckResult[];
  passed: boolean;
}

const DEFAULT_MIN_SAMPLES = 50;

export function runSCalibration(
  options: SCalibrationOptions,
): SCalibrationReport {
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

  const samples: SGameSample[] = [];

  for (let i = 0; i < matchups.length; i++) {
    const { home, away } = matchups[i];
    const gameId = `s-calibration-game-${i}`;
    const seed = deriveGameSeed(league.calibrationSeed, gameId);

    const result = simulate({ home, away, seed, gameId });
    const gameSamples = collectSSamples({
      game: result,
      home: teamById.get(home.teamId) ?? home,
      away: teamById.get(away.teamId) ?? away,
    });
    samples.push(...gameSamples);
  }

  const bucketReports: BucketReport<SGameSample>[] = bucketByAttr({
    samples,
    attr: (s) => s.sOverall,
    metrics: METRIC_EXTRACTORS,
  });

  const buckets: SBucketReport[] = bucketReports.map((report) => {
    const underSampled = report.samples.length < minSamplesPerBucket;
    const checks: BandCheckResult[] = S_METRICS.flatMap((metric) => {
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

export function formatSCalibrationReport(report: SCalibrationReport): string {
  const lines: string[] = [];
  lines.push(
    `S calibration — ${report.totalGames} games, ${report.totalSamples} S-games`,
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
