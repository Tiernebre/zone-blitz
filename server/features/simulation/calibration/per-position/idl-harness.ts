import { deriveGameSeed } from "../../rng.ts";
import { CALIBRATION_GAME_COUNT } from "../constants.ts";
import { generateMatchups } from "../harness.ts";
import type { SimulateFn } from "../harness.ts";
import type { CalibrationLeague } from "../generate-calibration-league.ts";
import { collectIdlSamples, type IdlGameSample } from "./idl-sample.ts";
import { bucketByAttr, type BucketReport } from "./bucket-by-attr.ts";
import { type BandCheckResult, checkBand } from "./band-check.ts";
import { loadPositionBands, type PositionBands } from "./band-loader.ts";

// Headline interior-DL metrics. All four are proxy counting stats —
// see `per-position-idl.R` and the attribution gap note in
// `idl-sample.ts` for limitations. Sacks are the only truly
// per-defender number; the rest are team-allocated and will look
// inflated until the engine logs per-defender tackles / TFLs / QB
// hits.
export const IDL_METRICS = [
  "sacks_per_game",
  "qb_hits_per_game",
  "tfl_per_game",
  "tackles_per_game",
] as const;

export type IdlMetric = typeof IDL_METRICS[number];

const METRIC_EXTRACTORS: Record<IdlMetric, (s: IdlGameSample) => number> = {
  sacks_per_game: (s) => s.sacks_per_game,
  qb_hits_per_game: (s) => s.qb_hits_per_game,
  tfl_per_game: (s) => s.tfl_per_game,
  tackles_per_game: (s) => s.tackles_per_game,
};

export interface IdlCalibrationOptions {
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

export interface IdlBucketReport {
  bucketLabel: string;
  bucketCenter: number;
  samples: number;
  underSampled: boolean;
  checks: BandCheckResult[];
}

export interface IdlCalibrationReport {
  totalGames: number;
  totalSamples: number;
  bands: PositionBands;
  buckets: IdlBucketReport[];
  failures: BandCheckResult[];
  passed: boolean;
}

const DEFAULT_MIN_SAMPLES = 50;

export function runIdlCalibration(
  options: IdlCalibrationOptions,
): IdlCalibrationReport {
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

  const samples: IdlGameSample[] = [];

  for (let i = 0; i < matchups.length; i++) {
    const { home, away } = matchups[i];
    const gameId = `idl-calibration-game-${i}`;
    const seed = deriveGameSeed(league.calibrationSeed, gameId);

    const result = simulate({ home, away, seed, gameId });
    const gameSamples = collectIdlSamples({
      game: result,
      home: teamById.get(home.teamId) ?? home,
      away: teamById.get(away.teamId) ?? away,
    });
    samples.push(...gameSamples);
  }

  const bucketReports: BucketReport<IdlGameSample>[] = bucketByAttr({
    samples,
    attr: (s) => s.idlOverall,
    metrics: METRIC_EXTRACTORS,
  });

  const buckets: IdlBucketReport[] = bucketReports.map((report) => {
    const underSampled = report.samples.length < minSamplesPerBucket;
    const checks: BandCheckResult[] = IDL_METRICS.flatMap((metric) => {
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

export function formatIdlCalibrationReport(
  report: IdlCalibrationReport,
): string {
  const lines: string[] = [];
  lines.push(
    `IDL calibration — ${report.totalGames} games, ${report.totalSamples} IDL-games`,
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
