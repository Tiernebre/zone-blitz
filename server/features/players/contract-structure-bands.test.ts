import { assertEquals } from "@std/assert";
import {
  bucketToContractPosition,
  getContractStructurePrior,
  qualityTierToContractTier,
} from "./contract-structure-bands.ts";

Deno.test("bucketToContractPosition maps specialist buckets to ST", () => {
  assertEquals(bucketToContractPosition("K"), "ST");
  assertEquals(bucketToContractPosition("P"), "ST");
  assertEquals(bucketToContractPosition("LS"), "ST");
});

Deno.test("bucketToContractPosition passes through non-specialist buckets", () => {
  assertEquals(bucketToContractPosition("QB"), "QB");
  assertEquals(bucketToContractPosition("IOL"), "IOL");
  assertEquals(bucketToContractPosition("CB"), "CB");
});

Deno.test("qualityTierToContractTier maps star/starter/depth to contract tiers", () => {
  assertEquals(qualityTierToContractTier("star"), "top_10");
  assertEquals(qualityTierToContractTier("starter"), "top_50");
  assertEquals(qualityTierToContractTier("depth"), "rest");
});

Deno.test("QB top-10 mean length exceeds CB top-10 mean length", () => {
  const qb = getContractStructurePrior("QB", "top_10");
  const cb = getContractStructurePrior("CB", "top_10");
  assertEquals(qb.lengthMean > cb.lengthMean, true);
});

Deno.test("IOL top-10 guarantee share exceeds OT top-10 guarantee share", () => {
  const iol = getContractStructurePrior("IOL", "top_10");
  const ot = getContractStructurePrior("OT", "top_10");
  assertEquals(iol.guaranteeShareMean > ot.guaranteeShareMean, true);
});

Deno.test("cap-hit shape is normalised to sum ~1", () => {
  const prior = getContractStructurePrior("QB", "top_10");
  const sum = prior.capHitShape.reduce((s, v) => s + v, 0);
  assertEquals(Math.abs(sum - 1) < 1e-9, true);
});

Deno.test("QB top-10 cap-hit shape is back-loaded (year 1 < year 5)", () => {
  const prior = getContractStructurePrior("QB", "top_10");
  assertEquals(prior.capHitShape[0] < prior.capHitShape[4], true);
});

Deno.test("rest-tier shape NaN year-5 values fall back to zero share", () => {
  const prior = getContractStructurePrior("QB", "rest");
  // The feed has NaN at year 5 for "rest"; our loader must coerce to 0
  // so downstream samplers get a finite shape.
  for (const v of prior.capHitShape) {
    assertEquals(Number.isFinite(v), true);
  }
});

Deno.test("every supported position × tier resolves without throwing", () => {
  const positions = [
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
    "ST",
  ] as const;
  const tiers = ["top_10", "top_25", "top_50", "rest"] as const;
  for (const p of positions) {
    for (const t of tiers) {
      const prior = getContractStructurePrior(p, t);
      assertEquals(Number.isFinite(prior.lengthMean), true);
      assertEquals(Number.isFinite(prior.guaranteeShareMean), true);
      assertEquals(Number.isFinite(prior.bonusShareMean), true);
    }
  }
});
