export interface AttrBucket {
  readonly label: string; // e.g. "50" — the bucket center
  readonly center: number;
  readonly min: number; // inclusive
  readonly max: number; // exclusive
}

// Five equal-width buckets spanning the 0-100 rating scale centered on
// 50. Calibration sanity check: the midpoint bucket (45-55) should
// produce NFL median-starter numbers — that directly tests the
// "rating midpoint is 50" contract.
export const DEFAULT_ATTR_BUCKETS: readonly AttrBucket[] = [
  { label: "30", center: 30, min: 25, max: 35 },
  { label: "40", center: 40, min: 35, max: 45 },
  { label: "50", center: 50, min: 45, max: 55 },
  { label: "60", center: 60, min: 55, max: 65 },
  { label: "70", center: 70, min: 65, max: 75 },
  { label: "80", center: 80, min: 75, max: 85 },
];

export interface MetricSummary {
  n: number;
  mean: number;
  sd: number;
}

export interface BucketReport<S> {
  bucket: AttrBucket;
  samples: S[];
  metrics: Record<string, MetricSummary>;
}

function meanAndSd(values: number[]): MetricSummary {
  const n = values.length;
  if (n === 0) return { n: 0, mean: 0, sd: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  return { n, mean, sd: Math.sqrt(variance) };
}

export interface BucketByAttrOptions<S> {
  samples: readonly S[];
  // Extracts the attribute value each sample should be bucketed on.
  attr: (sample: S) => number;
  metrics: Record<string, (sample: S) => number>;
  buckets?: readonly AttrBucket[];
}

export function bucketByAttr<S>(
  options: BucketByAttrOptions<S>,
): BucketReport<S>[] {
  const buckets = options.buckets ?? DEFAULT_ATTR_BUCKETS;

  return buckets.map((bucket) => {
    const samples = options.samples.filter((s) => {
      const value = options.attr(s);
      return value >= bucket.min && value < bucket.max;
    });

    const metrics: Record<string, MetricSummary> = {};
    for (const [name, extract] of Object.entries(options.metrics)) {
      metrics[name] = meanAndSd(samples.map(extract));
    }

    return { bucket, samples, metrics };
  });
}
