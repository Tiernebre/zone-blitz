import { deriveGameSeed } from "../../rng.ts";
import { CALIBRATION_GAME_COUNT } from "../constants.ts";
import { generateMatchups } from "../harness.ts";
import type { SimulateFn } from "../harness.ts";
import type { CalibrationLeague } from "../generate-calibration-league.ts";
import { collectOtSamples, type OtGameSample } from "./ot-sample.ts";
import { bucketByAttr, type BucketReport } from "./bucket-by-attr.ts";
import { type BandCheckResult, checkBand } from "./band-check.ts";
import { loadPositionBands, type PositionBands } from "./band-loader.ts";

// Metrics the OT slice reports on. All are **proxy metrics** (see the
// band-generation script at data/R/bands/per-position-ot.R) because
// nflreadr does not expose PFF pass-block / run-block grades or pressure
// counts. team_sack_allowed_rate and team_rush_ypc are team-level and
// shared by both starting tackles; penalties_per_game is clean per-player.
// starts_per_season is a participation sanity check.
//
// For this proxy fixture most headline metrics are "lower is better"
// (fewer sacks allowed, fewer penalties). team_rush_ypc is
// higher-is-better. The band-check flips direction labels accordingly.
export const OT_METRICS = [
  "team_sack_allowed_rate",
  "team_rush_ypc",
  "penalties_per_game",
] as const;

export type OtMetric = typeof OT_METRICS[number];

const METRIC_EXTRACTORS: Record<OtMetric, (s: OtGameSample) => number> = {
  team_sack_allowed_rate: (s) => s.team_sack_allowed_rate,
  team_rush_ypc: (s) => s.team_rush_ypc,
  penalties_per_game: (s) => s.penalties_per_game,
};

// Map metric name -> direction. Used to flip the verdict labels in the
// BandCheckResult: for a "lower is better" metric, a z-score above the
// band mean means the sim is too *bad*, not too "high".
const LOWER_IS_BETTER: Record<OtMetric, boolean> = {
  team_sack_allowed_rate: true,
  team_rush_ypc: false,
  penalties_per_game: true,
};

export interface OtCalibrationOptions {
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

export interface OtBucketReport {
  bucketLabel: string;
  bucketCenter: number;
  samples: number;
  underSampled: boolean;
  checks: BandCheckResult[];
}

export interface OtCalibrationReport {
  totalGames: number;
  totalSamples: number;
  bands: PositionBands;
  buckets: OtBucketReport[];
  failures: BandCheckResult[];
  passed: boolean;
}

// OT games produce two samples per team-game (two starting tackles),
// so twice as many samples per game as QB. Keep a comparable minimum
// per-bucket count (~50 samples) which is achievable at default
// CALIBRATION_GAME_COUNT.
const DEFAULT_MIN_SAMPLES = 50;

export function runOtCalibration(
  options: OtCalibrationOptions,
): OtCalibrationReport {
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

  const samples: OtGameSample[] = [];

  for (let i = 0; i < matchups.length; i++) {
    const { home, away } = matchups[i];
    const gameId = `ot-calibration-game-${i}`;
    const seed = deriveGameSeed(league.calibrationSeed, gameId);

    const result = simulate({ home, away, seed, gameId });
    const gameSamples = collectOtSamples({
      game: result,
      home: teamById.get(home.teamId) ?? home,
      away: teamById.get(away.teamId) ?? away,
    });
    samples.push(...gameSamples);
  }

  const bucketReports: BucketReport<OtGameSample>[] = bucketByAttr({
    samples,
    attr: (s) => s.otOverall,
    metrics: METRIC_EXTRACTORS,
  });

  const buckets: OtBucketReport[] = bucketReports.map((report) => {
    const underSampled = report.samples.length < minSamplesPerBucket;
    const checks: BandCheckResult[] = OT_METRICS.flatMap((metric) => {
      // Don't emit band checks on under-sampled buckets — the NFL band
      // comparison would be dominated by sampling noise.
      if (underSampled) return [];
      return [
        checkBand({
          bucketLabel: report.bucket.label,
          metricName: metric,
          simSummary: report.metrics[metric],
          bands,
          lowerIsBetter: LOWER_IS_BETTER[metric],
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

export function formatOtCalibrationReport(report: OtCalibrationReport): string {
  const lines: string[] = [];
  lines.push(
    `OT calibration — ${report.totalGames} games, ${report.totalSamples} OT-games`,
  );
  lines.push(
    `Bands: ${report.bands.position} / ${
      report.bands.seasons.join("-")
    } / ranked by ${report.bands.rankingStat}`,
  );
  lines.push(
    "NOTE: PROXY METRICS v1 — team_sack_allowed_rate and team_rush_ypc are " +
      "team-level, shared by both starting tackles. See " +
      "data/bands/per-position/ot.json notes for the PFF-grade gap.",
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
        `  ${verdict} ${check.metricName.padEnd(22)} ` +
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
