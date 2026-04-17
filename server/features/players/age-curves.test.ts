import { assertEquals } from "@std/assert";
import { mulberry32, type NeutralBucket } from "@zone-blitz/shared";
import {
  AGE_CURVE_PRIORS,
  BUCKET_AGE_CURVES,
  sampleBucketAge,
} from "./age-curves.ts";

const ALL_BUCKETS: readonly NeutralBucket[] = [
  "QB",
  "RB",
  "WR",
  "TE",
  "OT",
  "IOL",
  "EDGE",
  "IDL",
  "LB",
  "CB",
  "S",
  "K",
  "P",
  "LS",
];

const SAMPLES = 8000;

function collectSamples(
  bucket: NeutralBucket,
  seed: number,
  count = SAMPLES,
): number[] {
  const random = mulberry32(seed);
  const ages: number[] = [];
  for (let i = 0; i < count; i++) {
    ages.push(sampleBucketAge(random, bucket));
  }
  return ages;
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((p / 100) * sorted.length)),
  );
  return sorted[idx];
}

Deno.test("every neutral bucket has an age curve and prior", () => {
  for (const bucket of ALL_BUCKETS) {
    const curve = BUCKET_AGE_CURVES[bucket];
    assertEquals(curve.ages.length > 0, true, `${bucket} has no ages`);
    assertEquals(curve.ages.length, curve.weights.length);
    assertEquals(curve.cumulative.length, curve.weights.length);
    assertEquals(curve.totalWeight > 0, true);
    const prior = AGE_CURVE_PRIORS[bucket];
    assertEquals(prior.meanAge > 21, true);
    assertEquals(prior.p50Age >= 22, true);
    assertEquals(prior.p90Age >= prior.p50Age, true);
  }
});

Deno.test("per-bucket sampled mean age converges to the prior mean", () => {
  const tolerance = 0.5;
  for (const bucket of ALL_BUCKETS) {
    const ages = collectSamples(bucket, 1234 + bucket.length);
    const sampledMean = mean(ages);
    const priorMean = AGE_CURVE_PRIORS[bucket].meanAge;
    const delta = Math.abs(sampledMean - priorMean);
    assertEquals(
      delta <= tolerance,
      true,
      `${bucket} sampled mean ${sampledMean.toFixed(2)} vs prior ${
        priorMean.toFixed(2)
      } (Δ=${delta.toFixed(2)})`,
    );
  }
});

Deno.test("per-bucket sampled p90 converges to the prior p90", () => {
  for (const bucket of ALL_BUCKETS) {
    const ages = collectSamples(bucket, 9900 + bucket.length);
    const sampledP90 = percentile(ages, 90);
    const priorP90 = AGE_CURVE_PRIORS[bucket].p90Age;
    const delta = Math.abs(sampledP90 - priorP90);
    assertEquals(
      delta <= 1,
      true,
      `${bucket} sampled p90 ${sampledP90} vs prior ${priorP90}`,
    );
  }
});

Deno.test("RB age distribution shows the post-28 cliff", () => {
  const ages = collectSamples("RB", 9001);
  const over30Share = ages.filter((a) => a >= 30).length / ages.length;
  const priorP90 = AGE_CURVE_PRIORS["RB"].p90Age;
  // RB p_active drops below 10% at age 30 in real data.
  assertEquals(
    priorP90 <= 30,
    true,
    `RB prior p90 ${priorP90} too high for a cliff bucket`,
  );
  assertEquals(
    over30Share <= 0.12,
    true,
    `RB 30+ share ${(over30Share * 100).toFixed(1)}% too high`,
  );
});

Deno.test("QB has a longer active-age tail than RB", () => {
  const qbAges = collectSamples("QB", 42);
  const rbAges = collectSamples("RB", 42);
  const qb33Share = qbAges.filter((a) => a >= 33).length / qbAges.length;
  const rb33Share = rbAges.filter((a) => a >= 33).length / rbAges.length;
  assertEquals(
    qb33Share > rb33Share * 3,
    true,
    `QB 33+ share ${
      (qb33Share * 100).toFixed(1)
    }% not meaningfully longer than RB ${(rb33Share * 100).toFixed(1)}%`,
  );
});

Deno.test("OL buckets plateau longer than RB", () => {
  const rbShare = collectSamples("RB", 3000).filter((a) => a >= 30).length /
    SAMPLES;
  for (const bucket of ["OT", "IOL"] as const) {
    const share = collectSamples(bucket, 3100 + bucket.length).filter((a) =>
      a >= 30
    )
      .length / SAMPLES;
    assertEquals(
      share > rbShare,
      true,
      `${bucket} 30+ share ${(share * 100).toFixed(1)}% should exceed RB ${
        (rbShare * 100).toFixed(1)
      }%`,
    );
  }
});

Deno.test("specialist buckets have a much longer tail than skill positions", () => {
  const wrShare = collectSamples("WR", 4100).filter((a) => a >= 33).length /
    SAMPLES;
  for (const bucket of ["K", "P", "LS"] as const) {
    const share = collectSamples(bucket, 4200 + bucket.length).filter((a) =>
      a >= 33
    )
      .length / SAMPLES;
    assertEquals(
      share > wrShare * 2,
      true,
      `${bucket} 33+ share ${(share * 100).toFixed(1)}% should dwarf WR ${
        (wrShare * 100).toFixed(1)
      }%`,
    );
  }
});

Deno.test("sampleBucketAge is deterministic given the same rng seed", () => {
  const a = collectSamples("WR", 2026, 500);
  const b = collectSamples("WR", 2026, 500);
  assertEquals(a, b);
});
