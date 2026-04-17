import type { MetricSummary } from "./bucket-by-attr.ts";
import type { BandData, PercentileBand, PositionBands } from "./band-loader.ts";

// Maps each rating-bucket label to the NFL percentile band we expect
// that bucket's sim output to resemble. The 50 bucket anchors to the
// NFL median starter (average band); ratings above/below step the
// expected band one rank each way. 30 falls off the bottom, so pair
// it with replacement — same as 40 — since our NFL fixture only has
// five bands.
const DEFAULT_EXPECTED_BAND: Record<string, PercentileBand> = {
  "30": "replacement",
  "40": "weak",
  "50": "average",
  "60": "good",
  "70": "elite",
  "80": "elite",
};

export interface BandCheckArgs {
  bucketLabel: string;
  metricName: string;
  simSummary: MetricSummary;
  bands: PositionBands;
  // Override expected-band mapping per bucket; defaults to the
  // 30↔replacement, 40↔weak, 50↔average, 60↔good, 70/80↔elite mapping.
  expectedBand?: Record<string, PercentileBand>;
  // Some metrics (int_rate, sack_rate) are *better* when lower. We
  // still expect a 70 QB to land in the elite band — which for those
  // metrics means a lower mean. This only flips the direction of the
  // "missed high / missed low" verdict in the result.
  lowerIsBetter?: boolean;
}

export interface BandCheckResult {
  bucketLabel: string;
  metricName: string;
  expectedBand: PercentileBand;
  actualBand: PercentileBand | "none";
  simMean: number;
  simN: number;
  bandMean: number;
  bandSd: number;
  // Signed distance in band standard deviations. 0 = on the band's mean;
  // +1 = one sd above; negative = below.
  zScore: number;
  passed: boolean;
  direction: "on_target" | "too_high" | "too_low";
}

function classifyActualBand(
  simMean: number,
  bands: PositionBands,
  metricName: string,
): PercentileBand | "none" {
  // Walk bands in rating order from elite (highest mean on a
  // lower-is-better stat is flipped; but we always classify by which
  // band's mean this sim value is closest to). Bands aren't guaranteed
  // to be monotonic on every metric so "closest mean" is the honest
  // classification rather than threshold-walking.
  const order: PercentileBand[] = [
    "elite",
    "good",
    "average",
    "weak",
    "replacement",
  ];
  let best: { band: PercentileBand | "none"; distance: number } = {
    band: "none",
    distance: Infinity,
  };
  for (const name of order) {
    const m = bands.bands[name].metrics[metricName];
    if (!m) continue;
    const distance = Math.abs(simMean - m.mean);
    if (distance < best.distance) {
      best = { band: name, distance };
    }
  }
  return best.band;
}

export function expectedBandFor(
  bucketLabel: string,
  overrides?: Record<string, PercentileBand>,
): PercentileBand {
  const map = { ...DEFAULT_EXPECTED_BAND, ...(overrides ?? {}) };
  const expected = map[bucketLabel];
  if (!expected) {
    throw new Error(
      `No expected band mapping for bucket "${bucketLabel}". ` +
        `Provide an override via expectedBand.`,
    );
  }
  return expected;
}

export function checkBand(args: BandCheckArgs): BandCheckResult {
  const { bucketLabel, metricName, simSummary, bands } = args;
  const expected = expectedBandFor(bucketLabel, args.expectedBand);

  const band: BandData = bands.bands[expected];
  const bandMetric = band.metrics[metricName];
  if (!bandMetric) {
    throw new Error(
      `Band "${expected}" is missing metric "${metricName}"`,
    );
  }

  const actualBand = classifyActualBand(simSummary.mean, bands, metricName);

  const zScore = bandMetric.sd > 0
    ? (simSummary.mean - bandMetric.mean) / bandMetric.sd
    : 0;

  const direction: BandCheckResult["direction"] = actualBand === expected
    ? "on_target"
    : zScore > 0
    ? "too_high"
    : "too_low";

  return {
    bucketLabel,
    metricName,
    expectedBand: expected,
    actualBand,
    simMean: simSummary.mean,
    simN: simSummary.n,
    bandMean: bandMetric.mean,
    bandSd: bandMetric.sd,
    zScore,
    passed: actualBand === expected,
    direction,
  };
}
