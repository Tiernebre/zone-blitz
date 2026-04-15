export interface MetricBand {
  n: number;
  mean: number;
  sd: number;
  min: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  max: number;
}

const REQUIRED_FIELDS: (keyof MetricBand)[] = [
  "n",
  "mean",
  "sd",
  "min",
  "p10",
  "p25",
  "p50",
  "p75",
  "p90",
  "max",
];

function isMetricBand(value: unknown): value is MetricBand {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return REQUIRED_FIELDS.every((f) => typeof obj[f] === "number");
}

export function loadBands(jsonString: string): Map<string, MetricBand> {
  const parsed = JSON.parse(jsonString);

  if (!parsed.bands || typeof parsed.bands !== "object") {
    throw new Error("Band JSON missing 'bands' key");
  }

  const result = new Map<string, MetricBand>();

  for (const [key, value] of Object.entries(parsed.bands)) {
    if (typeof value !== "object" || value === null) continue;

    if (!isMetricBand(value)) {
      throw new Error(
        `Band "${key}" is missing required fields: ${
          REQUIRED_FIELDS.join(", ")
        }`,
      );
    }

    result.set(key, value);
  }

  return result;
}
