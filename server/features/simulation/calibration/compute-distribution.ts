export interface SimDistribution {
  mean: number;
  sd: number;
  p10: number;
  p90: number;
  n: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  const weight = rank - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function computeDistribution(values: number[]): SimDistribution {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  const sd = Math.sqrt(variance);

  const sorted = [...values].sort((a, b) => a - b);

  return {
    mean,
    sd,
    p10: percentile(sorted, 10),
    p90: percentile(sorted, 90),
    n,
  };
}
