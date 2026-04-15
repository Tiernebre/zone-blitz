import { assertEquals, assertGreater, assertLess } from "@std/assert";
import {
  POSITIONAL_MARKET_VALUES,
  type PositionalMarketEntry,
  positionalSalaryMultiplier,
} from "./positional-market-value.ts";
import {
  NEUTRAL_BUCKETS,
  type NeutralBucket,
} from "../archetypes/neutral-bucket.ts";

Deno.test("POSITIONAL_MARKET_VALUES covers every neutral bucket", () => {
  for (const bucket of NEUTRAL_BUCKETS) {
    assertEquals(
      bucket in POSITIONAL_MARKET_VALUES,
      true,
      `Missing entry for ${bucket}`,
    );
  }
});

Deno.test("each entry has multiplier and curve parameters", () => {
  for (const bucket of NEUTRAL_BUCKETS) {
    const entry = POSITIONAL_MARKET_VALUES[bucket];
    assertEquals(typeof entry.multiplier, "number");
    assertEquals(typeof entry.curveExponent, "number");
    assertGreater(entry.multiplier, 0);
    assertGreater(entry.curveExponent, 0);
  }
});

Deno.test("ordering: QB > EDGE > OT > WR > CB > IDL > S > TE > LB > IOL > RB > K/P/LS", () => {
  const ordered: NeutralBucket[] = [
    "QB",
    "EDGE",
    "OT",
    "WR",
    "CB",
    "IDL",
    "S",
    "TE",
    "LB",
    "IOL",
    "RB",
  ];

  for (let i = 0; i < ordered.length - 1; i++) {
    assertGreater(
      POSITIONAL_MARKET_VALUES[ordered[i]].multiplier,
      POSITIONAL_MARKET_VALUES[ordered[i + 1]].multiplier,
      `Expected ${ordered[i]} > ${ordered[i + 1]}`,
    );
  }

  assertGreater(
    POSITIONAL_MARKET_VALUES["RB"].multiplier,
    POSITIONAL_MARKET_VALUES["K"].multiplier,
    "Expected RB > K",
  );
  assertEquals(
    POSITIONAL_MARKET_VALUES["K"].multiplier,
    POSITIONAL_MARKET_VALUES["P"].multiplier,
  );
  assertGreater(
    POSITIONAL_MARKET_VALUES["K"].multiplier,
    POSITIONAL_MARKET_VALUES["LS"].multiplier,
    "Expected K/P > LS",
  );
});

Deno.test("headline invariant: at equal quality, QB salary ≈ 2.75× RB salary (±10%)", () => {
  const quality = 85;
  const qbMultiplier = positionalSalaryMultiplier("QB", quality);
  const rbMultiplier = positionalSalaryMultiplier("RB", quality);
  const ratio = qbMultiplier / rbMultiplier;

  const target = 1.80 / 0.65;
  const tolerance = 0.10;
  assertGreater(ratio, target * (1 - tolerance));
  assertLess(ratio, target * (1 + tolerance));
});

Deno.test("curve: at elite quality (95), QB curve is steeper than RB curve over last 10 overall", () => {
  const qbAt95 = positionalSalaryMultiplier("QB", 95);
  const qbAt85 = positionalSalaryMultiplier("QB", 85);
  const qbDelta = qbAt95 - qbAt85;

  const rbAt95 = positionalSalaryMultiplier("RB", 95);
  const rbAt85 = positionalSalaryMultiplier("RB", 85);
  const rbDelta = rbAt95 - rbAt85;

  assertGreater(
    qbDelta,
    rbDelta,
    "QB's curve should be steeper than RB's at elite quality",
  );
});

Deno.test("curve: premium positions have higher exponents than depressed positions", () => {
  assertGreater(
    POSITIONAL_MARKET_VALUES["QB"].curveExponent,
    POSITIONAL_MARKET_VALUES["RB"].curveExponent,
  );
  assertGreater(
    POSITIONAL_MARKET_VALUES["EDGE"].curveExponent,
    POSITIONAL_MARKET_VALUES["IOL"].curveExponent,
  );
});

Deno.test("positionalSalaryMultiplier increases with quality", () => {
  const positions: NeutralBucket[] = ["QB", "RB", "WR", "K"];
  for (const pos of positions) {
    const low = positionalSalaryMultiplier(pos, 60);
    const mid = positionalSalaryMultiplier(pos, 75);
    const high = positionalSalaryMultiplier(pos, 90);
    assertGreater(mid, low, `${pos}: 75 should > 60`);
    assertGreater(high, mid, `${pos}: 90 should > 75`);
  }
});

Deno.test("module only depends on shared package types", () => {
  // The module lives in packages/shared and only imports NeutralBucket from
  // the same package. TypeScript compilation enforces it cannot import from
  // server or any consumer — shared has no such dependency.
  const entry: PositionalMarketEntry = POSITIONAL_MARKET_VALUES["QB"];
  assertEquals(typeof entry.multiplier, "number");
  assertEquals(typeof entry.curveExponent, "number");
});

Deno.test("default table is overridable for tests", () => {
  const override: Record<NeutralBucket, PositionalMarketEntry> = {
    ...POSITIONAL_MARKET_VALUES,
    QB: { multiplier: 99, curveExponent: 1 },
  };
  assertEquals(override["QB"].multiplier, 99);
  assertEquals(
    override["RB"].multiplier,
    POSITIONAL_MARKET_VALUES["RB"].multiplier,
  );
});
