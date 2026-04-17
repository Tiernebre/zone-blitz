export const PERCENTILE_BANDS = [
  "elite",
  "good",
  "average",
  "weak",
  "replacement",
] as const;

export type PercentileBand = typeof PERCENTILE_BANDS[number];

export interface BandMetric {
  n: number;
  mean: number;
  sd: number;
}

export interface BandData {
  n: number;
  metrics: Record<string, BandMetric>;
}

export interface PositionBands {
  position: string;
  seasons: number[];
  rankingStat: string;
  bands: Record<PercentileBand, BandData>;
}

function isBandMetric(value: unknown): value is BandMetric {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.n === "number" &&
    typeof obj.mean === "number" &&
    typeof obj.sd === "number";
}

function parseBand(value: unknown, bandName: string): BandData {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Band "${bandName}" is not an object`);
  }
  const obj = value as Record<string, unknown>;
  if (typeof obj.n !== "number") {
    throw new Error(`Band "${bandName}" is missing numeric field "n"`);
  }
  const metricsRaw = obj.metrics;
  if (typeof metricsRaw !== "object" || metricsRaw === null) {
    throw new Error(`Band "${bandName}" is missing metrics object`);
  }
  const metrics: Record<string, BandMetric> = {};
  for (const [name, m] of Object.entries(metricsRaw)) {
    if (!isBandMetric(m)) {
      throw new Error(
        `Band "${bandName}" metric "${name}" is missing n/mean/sd`,
      );
    }
    metrics[name] = m;
  }
  return { n: obj.n, metrics };
}

export function loadPositionBands(jsonString: string): PositionBands {
  const parsed = JSON.parse(jsonString);

  if (typeof parsed.position !== "string") {
    throw new Error("Position band JSON missing 'position' key");
  }
  if (!parsed.bands || typeof parsed.bands !== "object") {
    throw new Error("Position band JSON missing 'bands' key");
  }

  const bands = {} as Record<PercentileBand, BandData>;
  for (const bandName of PERCENTILE_BANDS) {
    const raw = parsed.bands[bandName];
    if (raw === undefined) {
      throw new Error(
        `Position band JSON is missing band "${bandName}"`,
      );
    }
    bands[bandName] = parseBand(raw, bandName);
  }

  const seasonsRaw = parsed.seasons;
  const seasons = Array.isArray(seasonsRaw)
    ? seasonsRaw.filter((s): s is number => typeof s === "number")
    : [];

  return {
    position: parsed.position,
    seasons,
    rankingStat: typeof parsed.ranking_stat === "string"
      ? parsed.ranking_stat
      : "",
    bands,
  };
}
