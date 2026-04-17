import { assertEquals, assertThrows } from "@std/assert";
import { loadPositionBands, PERCENTILE_BANDS } from "./band-loader.ts";

function buildValidJson(overrides: Record<string, unknown> = {}): string {
  const band = () => ({
    n: 10,
    metrics: {
      completion_pct: { n: 10, mean: 0.6, sd: 0.03 },
    },
  });
  return JSON.stringify({
    position: "QB",
    seasons: [2020, 2021, 2022, 2023, 2024],
    ranking_stat: "epa_per_play",
    bands: {
      elite: band(),
      good: band(),
      average: band(),
      weak: band(),
      replacement: band(),
    },
    ...overrides,
  });
}

Deno.test("loadPositionBands parses position, seasons, and all five bands", () => {
  const bands = loadPositionBands(buildValidJson());
  assertEquals(bands.position, "QB");
  assertEquals(bands.seasons, [2020, 2021, 2022, 2023, 2024]);
  assertEquals(bands.rankingStat, "epa_per_play");
  for (const name of PERCENTILE_BANDS) {
    assertEquals(bands.bands[name].n, 10);
    assertEquals(bands.bands[name].metrics.completion_pct.mean, 0.6);
  }
});

Deno.test("loadPositionBands throws on missing position", () => {
  const json = JSON.stringify({
    seasons: [],
    bands: {
      elite: { n: 1, metrics: {} },
      good: { n: 1, metrics: {} },
      average: { n: 1, metrics: {} },
      weak: { n: 1, metrics: {} },
      replacement: { n: 1, metrics: {} },
    },
  });
  assertThrows(() => loadPositionBands(json), Error, "position");
});

Deno.test("loadPositionBands throws when a band is missing", () => {
  const full = JSON.parse(buildValidJson());
  delete full.bands.good;
  assertThrows(
    () => loadPositionBands(JSON.stringify(full)),
    Error,
    'missing band "good"',
  );
});

Deno.test("loadPositionBands throws when a metric is missing required fields", () => {
  const full = JSON.parse(buildValidJson());
  full.bands.elite.metrics.completion_pct = { mean: 0.6 };
  assertThrows(
    () => loadPositionBands(JSON.stringify(full)),
    Error,
    "n/mean/sd",
  );
});

Deno.test("loadPositionBands tolerates missing seasons + ranking_stat", () => {
  const full = JSON.parse(buildValidJson());
  delete full.seasons;
  delete full.ranking_stat;
  const bands = loadPositionBands(JSON.stringify(full));
  assertEquals(bands.seasons, []);
  assertEquals(bands.rankingStat, "");
});
