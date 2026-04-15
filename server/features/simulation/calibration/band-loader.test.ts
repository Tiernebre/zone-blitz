import { assertEquals, assertThrows } from "@std/assert";
import { loadBands, type MetricBand } from "./band-loader.ts";

const VALID_BAND: MetricBand = {
  n: 100,
  mean: 50,
  sd: 10,
  min: 20,
  p10: 35,
  p25: 42,
  p50: 50,
  p75: 58,
  p90: 65,
  max: 80,
};

Deno.test("loadBands parses valid band JSON", () => {
  const json = {
    generated_at: "2026-01-01T00:00:00Z",
    seasons: [2020, 2021],
    notes: "test",
    bands: {
      plays: VALID_BAND,
      pass_yards: { ...VALID_BAND, mean: 240 },
    },
  };

  const result = loadBands(JSON.stringify(json));
  assertEquals(result.size, 2);
  assertEquals(result.get("plays")!.mean, 50);
  assertEquals(result.get("pass_yards")!.mean, 240);
});

Deno.test("loadBands returns all 15 metrics from team-game.json shape", () => {
  const metrics = [
    "plays",
    "pass_attempts",
    "rush_attempts",
    "pass_rate",
    "rush_rate",
    "completion_pct",
    "yards_per_attempt",
    "yards_per_carry",
    "pass_yards",
    "rush_yards",
    "sacks_taken",
    "interceptions",
    "fumbles_lost",
    "turnovers",
    "penalties",
  ];

  const bands: Record<string, MetricBand> = {};
  for (const m of metrics) {
    bands[m] = { ...VALID_BAND };
  }

  const json = {
    generated_at: "2026-01-01T00:00:00Z",
    seasons: [2020],
    notes: "test",
    bands,
  };

  const result = loadBands(JSON.stringify(json));
  assertEquals(result.size, 15);
  for (const m of metrics) {
    assertEquals(result.has(m), true, `missing metric: ${m}`);
  }
});

Deno.test("loadBands throws on missing bands key", () => {
  assertThrows(
    () => loadBands(JSON.stringify({ generated_at: "x", seasons: [] })),
    Error,
  );
});

Deno.test("loadBands throws on band missing required field", () => {
  const json = {
    generated_at: "x",
    seasons: [],
    notes: "",
    bands: {
      plays: { n: 100, mean: 50 },
    },
  };
  assertThrows(() => loadBands(JSON.stringify(json)), Error);
});

Deno.test("loadBands skips non-object band entries", () => {
  const json = {
    generated_at: "x",
    seasons: [],
    notes: "",
    bands: {
      plays: VALID_BAND,
      bad: "not an object",
      also_bad: 42,
    },
  };
  const result = loadBands(JSON.stringify(json));
  assertEquals(result.size, 1);
  assertEquals(result.has("plays"), true);
});
