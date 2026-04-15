import { assertEquals } from "@std/assert";
import { checkThreeGate } from "./three-gate.ts";
import type { SimDistribution } from "./compute-distribution.ts";
import type { MetricBand } from "./band-loader.ts";

function makeBand(overrides?: Partial<MetricBand>): MetricBand {
  return {
    n: 2686,
    mean: 62.27,
    sd: 8.35,
    min: 33,
    p10: 52,
    p25: 57,
    p50: 62,
    p75: 68,
    p90: 73,
    max: 94,
    ...overrides,
  };
}

function makeDist(overrides?: Partial<SimDistribution>): SimDistribution {
  return {
    mean: 62.27,
    sd: 8.35,
    p10: 52,
    p90: 73,
    n: 2688,
    ...overrides,
  };
}

Deno.test("checkThreeGate passes when all three gates pass", () => {
  const result = checkThreeGate("plays", makeBand(), makeDist());
  assertEquals(result.passed, true);
  assertEquals(result.meanGate.passed, true);
  assertEquals(result.spreadGate.passed, true);
  assertEquals(result.tailGate.passed, true);
});

Deno.test("checkThreeGate mean gate fails when sim mean is too high", () => {
  const band = makeBand({ mean: 62.27, sd: 8.35 });
  const dist = makeDist({ mean: 63.0, n: 2688 });
  const threshold = 3.0 * 8.35 / Math.sqrt(2688);
  const diff = Math.abs(63.0 - 62.27);

  const result = checkThreeGate("plays", band, dist);
  if (diff > threshold) {
    assertEquals(result.meanGate.passed, false);
  } else {
    assertEquals(result.meanGate.passed, true);
  }
});

Deno.test("checkThreeGate mean gate fails with large drift", () => {
  const band = makeBand({ mean: 62.27, sd: 8.35 });
  const dist = makeDist({ mean: 70.0, n: 2688 });

  const result = checkThreeGate("plays", band, dist);
  assertEquals(result.meanGate.passed, false);
  assertEquals(result.passed, false);
});

Deno.test("checkThreeGate spread gate fails when sim sd is too low", () => {
  const band = makeBand({ sd: 10.0 });
  const dist = makeDist({ sd: 5.0 });

  const result = checkThreeGate("plays", band, dist);
  assertEquals(result.spreadGate.passed, false);
  assertEquals(result.passed, false);
});

Deno.test("checkThreeGate spread gate fails when sim sd is too high", () => {
  const band = makeBand({ sd: 10.0 });
  const dist = makeDist({ sd: 15.0 });

  const result = checkThreeGate("plays", band, dist);
  assertEquals(result.spreadGate.passed, false);
  assertEquals(result.passed, false);
});

Deno.test("checkThreeGate spread gate passes at boundary (±25%)", () => {
  const band = makeBand({ sd: 10.0 });
  const distLow = makeDist({ sd: 7.5 });
  const distHigh = makeDist({ sd: 12.5 });

  assertEquals(checkThreeGate("plays", band, distLow).spreadGate.passed, true);
  assertEquals(checkThreeGate("plays", band, distHigh).spreadGate.passed, true);
});

Deno.test("checkThreeGate tail gate fails when sim p10 is too low", () => {
  const band = makeBand({ p10: 52, sd: 8.35 });
  const dist = makeDist({ p10: 43 });

  const result = checkThreeGate("plays", band, dist);
  assertEquals(result.tailGate.passed, false);
  assertEquals(result.passed, false);
});

Deno.test("checkThreeGate tail gate fails when sim p90 is too high", () => {
  const band = makeBand({ p90: 73, sd: 8.35 });
  const dist = makeDist({ p90: 82 });

  const result = checkThreeGate("plays", band, dist);
  assertEquals(result.tailGate.passed, false);
  assertEquals(result.passed, false);
});

Deno.test("checkThreeGate tail gate passes within slack", () => {
  const band = makeBand({ p10: 52, p90: 73, sd: 8.35 });
  const dist = makeDist({ p10: 48, p90: 77 });

  const result = checkThreeGate("plays", band, dist);
  assertEquals(result.tailGate.passed, true);
});

Deno.test("checkThreeGate reports metric name in result", () => {
  const result = checkThreeGate("pass_yards", makeBand(), makeDist());
  assertEquals(result.metric, "pass_yards");
});

Deno.test("checkThreeGate reports all gate details even when passing", () => {
  const result = checkThreeGate("plays", makeBand(), makeDist());
  assertEquals(typeof result.meanGate.simValue, "number");
  assertEquals(typeof result.meanGate.threshold, "number");
  assertEquals(typeof result.spreadGate.simValue, "number");
  assertEquals(typeof result.spreadGate.lowerBound, "number");
  assertEquals(typeof result.spreadGate.upperBound, "number");
  assertEquals(typeof result.tailGate.simP10, "number");
  assertEquals(typeof result.tailGate.simP90, "number");
});
