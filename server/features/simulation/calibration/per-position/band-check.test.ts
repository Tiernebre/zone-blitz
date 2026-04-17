import { assertEquals, assertThrows } from "@std/assert";
import { checkBand, expectedBandFor } from "./band-check.ts";
import type { PositionBands } from "./band-loader.ts";

function bandsFixture(): PositionBands {
  return {
    position: "QB",
    seasons: [2020, 2021, 2022, 2023, 2024],
    rankingStat: "epa_per_play",
    bands: {
      elite: {
        n: 18,
        metrics: { ypa: { n: 18, mean: 8.2, sd: 0.6 } },
      },
      good: {
        n: 35,
        metrics: { ypa: { n: 35, mean: 7.6, sd: 0.4 } },
      },
      average: {
        n: 70,
        metrics: { ypa: { n: 70, mean: 7.1, sd: 0.45 } },
      },
      weak: {
        n: 35,
        metrics: { ypa: { n: 35, mean: 6.5, sd: 0.4 } },
      },
      replacement: {
        n: 18,
        metrics: { ypa: { n: 18, mean: 6.2, sd: 0.5 } },
      },
    },
  };
}

Deno.test("expectedBandFor defaults map 50→average, 70→elite, 40→weak, 30→replacement", () => {
  assertEquals(expectedBandFor("50"), "average");
  assertEquals(expectedBandFor("40"), "weak");
  assertEquals(expectedBandFor("60"), "good");
  assertEquals(expectedBandFor("70"), "elite");
  assertEquals(expectedBandFor("80"), "elite");
  assertEquals(expectedBandFor("30"), "replacement");
});

Deno.test("expectedBandFor honors overrides", () => {
  assertEquals(expectedBandFor("50", { "50": "good" }), "good");
});

Deno.test("expectedBandFor throws on unknown bucket label", () => {
  assertThrows(() => expectedBandFor("99"), Error, "No expected band");
});

Deno.test("checkBand passes when sim mean is closest to the expected band", () => {
  const result = checkBand({
    bucketLabel: "50",
    metricName: "ypa",
    simSummary: { n: 500, mean: 7.1, sd: 0.4 },
    bands: bandsFixture(),
  });
  assertEquals(result.expectedBand, "average");
  assertEquals(result.actualBand, "average");
  assertEquals(result.passed, true);
  assertEquals(result.direction, "on_target");
});

Deno.test("checkBand fails with 'too_high' when sim mean lands in a better band", () => {
  const result = checkBand({
    bucketLabel: "50",
    metricName: "ypa",
    simSummary: { n: 500, mean: 7.6, sd: 0.4 },
    bands: bandsFixture(),
  });
  assertEquals(result.expectedBand, "average");
  assertEquals(result.actualBand, "good");
  assertEquals(result.passed, false);
  assertEquals(result.direction, "too_high");
});

Deno.test("checkBand fails with 'too_low' when sim mean drops below expected", () => {
  const result = checkBand({
    bucketLabel: "70",
    metricName: "ypa",
    simSummary: { n: 500, mean: 7.1, sd: 0.4 },
    bands: bandsFixture(),
  });
  assertEquals(result.expectedBand, "elite");
  assertEquals(result.actualBand, "average");
  assertEquals(result.passed, false);
  assertEquals(result.direction, "too_low");
});

Deno.test("checkBand reports a z-score expressing distance from band mean", () => {
  const result = checkBand({
    bucketLabel: "50",
    metricName: "ypa",
    simSummary: { n: 500, mean: 7.55, sd: 0.4 },
    bands: bandsFixture(),
  });
  // band average ypa is 7.1, sd 0.45 → z = (7.55 - 7.1)/0.45 = 1.0
  assertEquals(Math.round(result.zScore * 10) / 10, 1.0);
});

Deno.test("checkBand throws if the band is missing the requested metric", () => {
  assertThrows(
    () =>
      checkBand({
        bucketLabel: "50",
        metricName: "missing",
        simSummary: { n: 1, mean: 0, sd: 0 },
        bands: bandsFixture(),
      }),
    Error,
    'missing metric "missing"',
  );
});
