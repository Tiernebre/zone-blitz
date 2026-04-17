import { deriveGameSeed } from "../../rng.ts";
import { CALIBRATION_GAME_COUNT } from "../constants.ts";
import { generateMatchups } from "../harness.ts";
import type { SimulateFn } from "../harness.ts";
import type { CalibrationLeague } from "../generate-calibration-league.ts";
import { type CbGameSample, collectCbSamples } from "./cb-sample.ts";
import { bucketByAttr, type BucketReport } from "./bucket-by-attr.ts";
import { type BandCheckResult, checkBand } from "./band-check.ts";
import {
  loadPositionBands,
  type PercentileBand,
  type PositionBands,
} from "./band-loader.ts";

// Headline CB metrics. `pbus_per_game` and `ints_per_game` are the
// two with real NFL grounding in `data/bands/per-position/cb.json`;
// the other four are placeholders the fixture can't fill until FTN
// or PFF coverage data is joined in (see per-position-cb.R header).
// The harness still reports all six per bucket — it just skips band
// checks for any metric where the expected band has no samples, so
// the fixture slot can be filled later without code changes.
export const CB_METRICS = [
  "targets_per_game",
  "completion_allowed_pct",
  "yards_per_target_allowed",
  "pbu_rate",
  "pbus_per_game",
  "ints_per_game",
] as const;

export type CbMetric = typeof CB_METRICS[number];

// Defensive metrics where a *lower* sim value means a better CB. The
// harness passes this through to `checkBand` so that "elite" is the
// band with the smallest mean for these stats — see
// `expectedBandFor` + `classifyActualBand` for how that's used.
const METRIC_LOWER_IS_BETTER: Record<CbMetric, boolean> = {
  targets_per_game: true,
  completion_allowed_pct: true,
  yards_per_target_allowed: true,
  pbu_rate: false,
  pbus_per_game: false,
  ints_per_game: false,
};

// Mirrored locally because `band-check.ts` keeps its mapping private;
// the harness needs read-through access to skip metrics missing from
// the fixture without modifying the shared module.
const DEFAULT_EXPECTED_BAND: Record<string, PercentileBand> = {
  "30": "replacement",
  "40": "weak",
  "50": "average",
  "60": "good",
  "70": "elite",
  "80": "elite",
};

const METRIC_EXTRACTORS: Record<CbMetric, (s: CbGameSample) => number> = {
  targets_per_game: (s) => s.targets_per_game,
  completion_allowed_pct: (s) => s.completion_allowed_pct,
  yards_per_target_allowed: (s) => s.yards_per_target_allowed,
  pbu_rate: (s) => s.pbu_rate,
  pbus_per_game: (s) => s.pbus_per_game,
  ints_per_game: (s) => s.ints_per_game,
};

export interface CbCalibrationOptions {
  bandJson: string;
  league: CalibrationLeague;
  simulate: SimulateFn;
  gameCount?: number;
  minSamplesPerBucket?: number;
}

export interface CbBucketReport {
  bucketLabel: string;
  bucketCenter: number;
  samples: number;
  underSampled: boolean;
  checks: BandCheckResult[];
}

export interface CbCalibrationReport {
  totalGames: number;
  totalSamples: number;
  bands: PositionBands;
  buckets: CbBucketReport[];
  failures: BandCheckResult[];
  passed: boolean;
}

const DEFAULT_MIN_SAMPLES = 50;

export function runCbCalibration(
  options: CbCalibrationOptions,
): CbCalibrationReport {
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

  const samples: CbGameSample[] = [];

  for (let i = 0; i < matchups.length; i++) {
    const { home, away } = matchups[i];
    const gameId = `cb-calibration-game-${i}`;
    const seed = deriveGameSeed(league.calibrationSeed, gameId);

    const result = simulate({ home, away, seed, gameId });
    const gameSamples = collectCbSamples({
      game: result,
      home: teamById.get(home.teamId) ?? home,
      away: teamById.get(away.teamId) ?? away,
    });
    samples.push(...gameSamples);
  }

  const bucketReports: BucketReport<CbGameSample>[] = bucketByAttr({
    samples,
    attr: (s) => s.cbOverall,
    metrics: METRIC_EXTRACTORS,
  });

  const buckets: CbBucketReport[] = bucketReports.map((report) => {
    const underSampled = report.samples.length < minSamplesPerBucket;
    const checks: BandCheckResult[] = CB_METRICS.flatMap((metric) => {
      if (underSampled) return [];
      // Skip metrics that the NFL fixture has no data for. The CB
      // fixture currently emits n=0 slots for completion% allowed,
      // yards/target, targets/game, and pbu_rate — see the script
      // header for why. Dropping them here keeps the calibration
      // report honest: we don't invent a PASS/FAIL from zero data.
      const expectedBand = DEFAULT_EXPECTED_BAND[report.bucket.label];
      if (expectedBand === undefined) return [];
      const ref = bands.bands[expectedBand].metrics[metric];
      if (!ref || ref.n === 0) return [];
      return [
        checkBand({
          bucketLabel: report.bucket.label,
          metricName: metric,
          simSummary: report.metrics[metric],
          bands,
          lowerIsBetter: METRIC_LOWER_IS_BETTER[metric],
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

export function formatCbCalibrationReport(report: CbCalibrationReport): string {
  const lines: string[] = [];
  lines.push(
    `CB calibration — ${report.totalGames} games, ${report.totalSamples} CB-games`,
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
