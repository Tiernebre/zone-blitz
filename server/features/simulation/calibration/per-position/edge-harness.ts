import { deriveGameSeed } from "../../rng.ts";
import { CALIBRATION_GAME_COUNT } from "../constants.ts";
import { generateMatchups } from "../harness.ts";
import type { SimulateFn } from "../harness.ts";
import type { CalibrationLeague } from "../generate-calibration-league.ts";
import { collectEdgeSamples, type EdgeGameSample } from "./edge-sample.ts";
import { bucketByAttr, type BucketReport } from "./bucket-by-attr.ts";
import { type BandCheckResult, checkBand } from "./band-check.ts";
import { loadPositionBands, type PositionBands } from "./band-loader.ts";

// Proxy metrics, v1 per issue #496. nflreadr doesn't carry PFF
// pass-rush grades and the sim engine doesn't emit qb_hit / tfl
// events, so the headline EDGE metrics here are box-score proxies.
// See per-position-edge.R and edge-sample.ts for the full gap writeup.
//
// - sacks_per_game is directly attributed (engine logs the rushing
//   defender as a participant).
// - qb_hits_per_game is derived from team-level `pressure` tags,
//   allocated to EDGE starters proportional to passRushing — loses
//   individual signal but preserves team totals.
// - tfl_per_game will always be 0 from the sim until the engine emits
//   a TFL concept. Surfacing the gap via a FAIL-low band check is the
//   calibration report's job.
export const EDGE_METRICS = [
  "sacks_per_game",
  "qb_hits_per_game",
  "tfl_per_game",
] as const;

export type EdgeMetric = typeof EDGE_METRICS[number];

const METRIC_EXTRACTORS: Record<EdgeMetric, (s: EdgeGameSample) => number> = {
  sacks_per_game: (s) => s.sacks_per_game,
  qb_hits_per_game: (s) => s.qb_hits_per_game,
  tfl_per_game: (s) => s.tfl_per_game,
};

export interface EdgeCalibrationOptions {
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

export interface EdgeBucketReport {
  bucketLabel: string;
  bucketCenter: number;
  samples: number;
  underSampled: boolean;
  checks: BandCheckResult[];
}

export interface EdgeCalibrationReport {
  totalGames: number;
  totalSamples: number;
  bands: PositionBands;
  buckets: EdgeBucketReport[];
  failures: BandCheckResult[];
  passed: boolean;
}

const DEFAULT_MIN_SAMPLES = 50;

export function runEdgeCalibration(
  options: EdgeCalibrationOptions,
): EdgeCalibrationReport {
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

  const samples: EdgeGameSample[] = [];

  for (let i = 0; i < matchups.length; i++) {
    const { home, away } = matchups[i];
    const gameId = `edge-calibration-game-${i}`;
    const seed = deriveGameSeed(league.calibrationSeed, gameId);

    const result = simulate({ home, away, seed, gameId });
    const gameSamples = collectEdgeSamples({
      game: result,
      home: teamById.get(home.teamId) ?? home,
      away: teamById.get(away.teamId) ?? away,
    });
    samples.push(...gameSamples);
  }

  const bucketReports: BucketReport<EdgeGameSample>[] = bucketByAttr({
    samples,
    attr: (s) => s.edgeOverall,
    metrics: METRIC_EXTRACTORS,
  });

  const buckets: EdgeBucketReport[] = bucketReports.map((report) => {
    const underSampled = report.samples.length < minSamplesPerBucket;
    const checks: BandCheckResult[] = EDGE_METRICS.flatMap((metric) => {
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

export function formatEdgeCalibrationReport(
  report: EdgeCalibrationReport,
): string {
  const lines: string[] = [];
  lines.push(
    `EDGE calibration — ${report.totalGames} games, ${report.totalSamples} EDGE-games`,
  );
  lines.push(
    `Bands: ${report.bands.position} / ${
      report.bands.seasons.join("-")
    } / ranked by ${report.bands.rankingStat}`,
  );
  lines.push(
    "Proxy metrics (v1 per issue #496): sacks attributed, qb_hits " +
      "allocated from team pressures, tfl not emitted by sim.",
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
