import { deriveGameSeed } from "../../rng.ts";
import { CALIBRATION_GAME_COUNT } from "../constants.ts";
import { generateMatchups } from "../harness.ts";
import type { SimulateFn } from "../harness.ts";
import type { CalibrationLeague } from "../generate-calibration-league.ts";
import { collectIolSamples, type IolGameSample } from "./iol-sample.ts";
import { bucketByAttr, type BucketReport } from "./bucket-by-attr.ts";
import { type BandCheckResult, checkBand } from "./band-check.ts";
import { loadPositionBands, type PositionBands } from "./band-loader.ts";

// Metrics the IOL slice reports on. All four mirror the R fixture's
// band metrics; first two are team proxies (limitation documented in
// iol-sample.ts + iol.json notes), penalties_per_game is per-player,
// starts_per_season is always 1 per game-sample so its "mean" reports
// 1.0 — included for structural parity with the fixture, not as a
// calibration signal.
export const IOL_METRICS = [
  "team_sack_allowed_rate",
  "team_stuff_rate_inside",
  "penalties_per_game",
] as const;

export type IolMetric = typeof IOL_METRICS[number];

const METRIC_EXTRACTORS: Record<IolMetric, (s: IolGameSample) => number> = {
  team_sack_allowed_rate: (s) => s.team_sack_allowed_rate,
  team_stuff_rate_inside: (s) => s.team_stuff_rate_inside,
  penalties_per_game: (s) => s.penalties_per_game,
};

export interface IolCalibrationOptions {
  bandJson: string;
  league: CalibrationLeague;
  simulate: SimulateFn;
  gameCount?: number;
  // Minimum samples per bucket before we trust a band check. Under
  // this count we still emit the summary but flag it as under-sampled.
  minSamplesPerBucket?: number;
}

export interface IolBucketReport {
  bucketLabel: string;
  bucketCenter: number;
  samples: number;
  underSampled: boolean;
  checks: BandCheckResult[];
}

export interface IolCalibrationReport {
  totalGames: number;
  totalSamples: number;
  bands: PositionBands;
  buckets: IolBucketReport[];
  failures: BandCheckResult[];
  passed: boolean;
}

const DEFAULT_MIN_SAMPLES = 50;

// All three IOL metrics are "lower is better" for the offense (fewer
// sacks, fewer stuffs, fewer penalties). The elite band mean sits
// below the replacement band mean on each, so band-check classifies
// naturally without a direction flip — bucket-to-expected-band mapping
// from band-check.ts does the right thing. Documented for future
// readers who may reuse these metrics.
export function runIolCalibration(
  options: IolCalibrationOptions,
): IolCalibrationReport {
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

  const samples: IolGameSample[] = [];

  for (let i = 0; i < matchups.length; i++) {
    const { home, away } = matchups[i];
    const gameId = `iol-calibration-game-${i}`;
    const seed = deriveGameSeed(league.calibrationSeed, gameId);

    const result = simulate({ home, away, seed, gameId });
    const gameSamples = collectIolSamples({
      game: result,
      home: teamById.get(home.teamId) ?? home,
      away: teamById.get(away.teamId) ?? away,
    });
    samples.push(...gameSamples);
  }

  const bucketReports: BucketReport<IolGameSample>[] = bucketByAttr({
    samples,
    attr: (s) => s.iolOverall,
    metrics: METRIC_EXTRACTORS,
  });

  const buckets: IolBucketReport[] = bucketReports.map((report) => {
    const underSampled = report.samples.length < minSamplesPerBucket;
    const checks: BandCheckResult[] = IOL_METRICS.flatMap((metric) => {
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

export function formatIolCalibrationReport(
  report: IolCalibrationReport,
): string {
  const lines: string[] = [];
  lines.push(
    `IOL calibration — ${report.totalGames} games, ${report.totalSamples} IOL-games`,
  );
  lines.push(
    `Bands: ${report.bands.position} / ${
      report.bands.seasons.join("-")
    } / ranked by ${report.bands.rankingStat}`,
  );
  lines.push(
    "NOTE: team_sack_allowed_rate and team_stuff_rate_inside are " +
      "team-level proxies shared across all IOL starters — PFF " +
      "block/pressure grades are not available in nflreadr.",
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
        `  ${verdict} ${check.metricName.padEnd(24)} ` +
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
