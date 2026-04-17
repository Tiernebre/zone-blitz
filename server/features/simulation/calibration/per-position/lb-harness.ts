import { deriveGameSeed } from "../../rng.ts";
import { CALIBRATION_GAME_COUNT } from "../constants.ts";
import { generateMatchups } from "../harness.ts";
import type { SimulateFn } from "../harness.ts";
import type { CalibrationLeague } from "../generate-calibration-league.ts";
import { collectLbSamples, type LbGameSample } from "./lb-sample.ts";
import { bucketByAttr, type BucketReport } from "./bucket-by-attr.ts";
import { type BandCheckResult, checkBand } from "./band-check.ts";
import { loadPositionBands, type PositionBands } from "./band-loader.ts";

// Headline LB metrics. Tackles/game is the volume anchor, TFL/game
// captures the havoc side of the role, PBU/game measures coverage
// playmaking, and solo_tackle_rate is the only stat that isolates
// individual technique from team scheme. Forced fumbles and sacks
// are intentionally omitted — the LB fixture ranks off-ball LBs, and
// those stats are owned by the pass-rush (EDGE/IDL) calibration slice.
export const LB_METRICS = [
  "tackles_per_game",
  "tfl_per_game",
  "solo_tackle_rate",
  "pbu_per_game",
] as const;

export type LbMetric = typeof LB_METRICS[number];

const METRIC_EXTRACTORS: Record<LbMetric, (s: LbGameSample) => number> = {
  tackles_per_game: (s) => s.tackles_per_game,
  tfl_per_game: (s) => s.tfl_per_game,
  solo_tackle_rate: (s) => s.solo_tackle_rate,
  pbu_per_game: (s) => s.pbu_per_game,
};

export interface LbCalibrationOptions {
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

export interface LbBucketReport {
  bucketLabel: string;
  bucketCenter: number;
  samples: number;
  underSampled: boolean;
  checks: BandCheckResult[];
}

export interface LbCalibrationReport {
  totalGames: number;
  totalSamples: number;
  bands: PositionBands;
  buckets: LbBucketReport[];
  failures: BandCheckResult[];
  passed: boolean;
}

const DEFAULT_MIN_SAMPLES = 50;

export function runLbCalibration(
  options: LbCalibrationOptions,
): LbCalibrationReport {
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

  const samples: LbGameSample[] = [];

  for (let i = 0; i < matchups.length; i++) {
    const { home, away } = matchups[i];
    const gameId = `lb-calibration-game-${i}`;
    const seed = deriveGameSeed(league.calibrationSeed, gameId);

    const result = simulate({ home, away, seed, gameId });
    const gameSamples = collectLbSamples({
      game: result,
      home: teamById.get(home.teamId) ?? home,
      away: teamById.get(away.teamId) ?? away,
    });
    samples.push(...gameSamples);
  }

  const bucketReports: BucketReport<LbGameSample>[] = bucketByAttr({
    samples,
    attr: (s) => s.lbOverall,
    metrics: METRIC_EXTRACTORS,
  });

  const buckets: LbBucketReport[] = bucketReports.map((report) => {
    const underSampled = report.samples.length < minSamplesPerBucket;
    const checks: BandCheckResult[] = LB_METRICS.flatMap((metric) => {
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

export function formatLbCalibrationReport(report: LbCalibrationReport): string {
  const lines: string[] = [];
  lines.push(
    `LB calibration — ${report.totalGames} games, ${report.totalSamples} LB-games`,
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
