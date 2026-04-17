import { assertAlmostEquals, assertEquals } from "@std/assert";
import { bucketByAttr, DEFAULT_ATTR_BUCKETS } from "./bucket-by-attr.ts";

interface Sample {
  overall: number;
  ypa: number;
  completion_pct: number;
}

Deno.test("bucketByAttr groups samples by attribute into the default 10-point bands", () => {
  const samples: Sample[] = [
    { overall: 40, ypa: 6, completion_pct: 0.55 },
    { overall: 41, ypa: 6.2, completion_pct: 0.6 },
    { overall: 50, ypa: 7, completion_pct: 0.62 },
    { overall: 55, ypa: 7.5, completion_pct: 0.63 },
    { overall: 71, ypa: 8.2, completion_pct: 0.69 },
  ];
  const report = bucketByAttr({
    samples,
    attr: (s) => s.overall,
    metrics: {
      ypa: (s) => s.ypa,
      completion_pct: (s) => s.completion_pct,
    },
  });
  assertEquals(report.length, DEFAULT_ATTR_BUCKETS.length);
  const fortyBucket = report.find((r) => r.bucket.label === "40")!;
  assertEquals(fortyBucket.samples.length, 2);
  const fiftyBucket = report.find((r) => r.bucket.label === "50")!;
  assertEquals(fiftyBucket.samples.length, 1); // 50 is in [45,55); 55 is not
  const sixtyBucket = report.find((r) => r.bucket.label === "60")!;
  assertEquals(sixtyBucket.samples.length, 1); // 55 lands here
  const seventyBucket = report.find((r) => r.bucket.label === "70")!;
  assertEquals(seventyBucket.samples.length, 1);
});

Deno.test("bucketByAttr computes mean and sd per metric per bucket", () => {
  const samples: Sample[] = [
    { overall: 50, ypa: 6, completion_pct: 0.6 },
    { overall: 52, ypa: 8, completion_pct: 0.7 },
  ];
  const report = bucketByAttr({
    samples,
    attr: (s) => s.overall,
    metrics: {
      ypa: (s) => s.ypa,
      completion_pct: (s) => s.completion_pct,
    },
  });
  const fiftyBucket = report.find((r) => r.bucket.label === "50")!;
  assertEquals(fiftyBucket.metrics.ypa.n, 2);
  assertAlmostEquals(fiftyBucket.metrics.ypa.mean, 7);
  assertAlmostEquals(fiftyBucket.metrics.ypa.sd, 1); // population sd of [6,8]
  assertAlmostEquals(fiftyBucket.metrics.completion_pct.mean, 0.65);
});

Deno.test("bucketByAttr returns zeroed metrics for empty buckets", () => {
  const samples: Sample[] = [
    { overall: 50, ypa: 7, completion_pct: 0.62 },
  ];
  const report = bucketByAttr({
    samples,
    attr: (s) => s.overall,
    metrics: { ypa: (s) => s.ypa, completion_pct: (s) => s.completion_pct },
  });
  const thirtyBucket = report.find((r) => r.bucket.label === "30")!;
  assertEquals(thirtyBucket.samples.length, 0);
  assertEquals(thirtyBucket.metrics.ypa.n, 0);
  assertEquals(thirtyBucket.metrics.ypa.mean, 0);
  assertEquals(thirtyBucket.metrics.ypa.sd, 0);
});

Deno.test("bucketByAttr supports custom bucket definitions", () => {
  const report = bucketByAttr({
    samples: [{ overall: 42, ypa: 6, completion_pct: 0.55 }] as Sample[],
    attr: (s: Sample) => s.overall,
    metrics: { ypa: (s: Sample) => s.ypa },
    buckets: [
      { label: "low", center: 35, min: 0, max: 45 },
      { label: "high", center: 65, min: 45, max: 100 },
    ],
  });
  assertEquals(report.length, 2);
  assertEquals(report[0].samples.length, 1);
  assertEquals(report[1].samples.length, 0);
});
