import { assertEquals } from "@std/assert";
import type { NeutralBucket } from "../archetypes/neutral-bucket.ts";
import { statColumnsForBucket } from "./position-stat-columns.ts";

Deno.test("statColumnsForBucket — QB returns passing columns", () => {
  const cols = statColumnsForBucket("QB");
  const keys = cols.map((c) => c.key);
  assertEquals(keys.includes("passingYards"), true);
  assertEquals(keys.includes("passingTouchdowns"), true);
  assertEquals(keys.includes("interceptions"), true);
  assertEquals(keys.includes("completions"), true);
  assertEquals(keys.includes("attempts"), true);
  assertEquals(keys.includes("completionPercentage"), true);
  assertEquals(keys.includes("passerRating"), true);
});

Deno.test("statColumnsForBucket — RB returns rushing columns", () => {
  const cols = statColumnsForBucket("RB");
  const keys = cols.map((c) => c.key);
  assertEquals(keys.includes("rushingYards"), true);
  assertEquals(keys.includes("rushingTouchdowns"), true);
  assertEquals(keys.includes("rushingAttempts"), true);
  assertEquals(keys.includes("yardsPerCarry"), true);
  assertEquals(keys.includes("fumbles"), true);
});

Deno.test("statColumnsForBucket — WR returns receiving columns", () => {
  const cols = statColumnsForBucket("WR");
  const keys = cols.map((c) => c.key);
  assertEquals(keys.includes("receptions"), true);
  assertEquals(keys.includes("receivingYards"), true);
  assertEquals(keys.includes("receivingTouchdowns"), true);
  assertEquals(keys.includes("targets"), true);
  assertEquals(keys.includes("yardsPerReception"), true);
});

Deno.test("statColumnsForBucket — TE returns receiving columns (same as WR)", () => {
  const wCols = statColumnsForBucket("WR");
  const tCols = statColumnsForBucket("TE");
  assertEquals(wCols, tCols);
});

const frontSeven: NeutralBucket[] = ["EDGE", "IDL", "LB"];
for (const bucket of frontSeven) {
  Deno.test(`statColumnsForBucket — ${bucket} returns defensive columns`, () => {
    const cols = statColumnsForBucket(bucket);
    const keys = cols.map((c) => c.key);
    assertEquals(keys.includes("tackles"), true);
    assertEquals(keys.includes("sacks"), true);
    assertEquals(keys.includes("tacklesForLoss"), true);
    assertEquals(keys.includes("interceptions"), true);
    assertEquals(keys.includes("passDefenses"), true);
    assertEquals(keys.includes("forcedFumbles"), true);
  });
}

const secondary: NeutralBucket[] = ["CB", "S"];
for (const bucket of secondary) {
  Deno.test(`statColumnsForBucket — ${bucket} returns defensive columns`, () => {
    const cols = statColumnsForBucket(bucket);
    const keys = cols.map((c) => c.key);
    assertEquals(keys.includes("tackles"), true);
    assertEquals(keys.includes("sacks"), true);
    assertEquals(keys.includes("interceptions"), true);
    assertEquals(keys.includes("passDefenses"), true);
  });
}

Deno.test("statColumnsForBucket — K returns kicking columns", () => {
  const cols = statColumnsForBucket("K");
  const keys = cols.map((c) => c.key);
  assertEquals(keys.includes("fieldGoalsMade"), true);
  assertEquals(keys.includes("fieldGoalsAttempted"), true);
  assertEquals(keys.includes("fieldGoalPercentage"), true);
  assertEquals(keys.includes("extraPointsMade"), true);
  assertEquals(keys.includes("extraPointsAttempted"), true);
});

Deno.test("statColumnsForBucket — P returns punting columns", () => {
  const cols = statColumnsForBucket("P");
  const keys = cols.map((c) => c.key);
  assertEquals(keys.includes("punts"), true);
  assertEquals(keys.includes("puntingYards"), true);
  assertEquals(keys.includes("puntingAverage"), true);
  assertEquals(keys.includes("puntsInside20"), true);
});

Deno.test("statColumnsForBucket — OL buckets return empty stat columns", () => {
  for (const bucket of ["OT", "IOL", "LS"] as NeutralBucket[]) {
    const cols = statColumnsForBucket(bucket);
    assertEquals(cols.length, 0);
  }
});

Deno.test("every column definition has a non-empty label", () => {
  const allBuckets: NeutralBucket[] = [
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
  for (const bucket of allBuckets) {
    for (const col of statColumnsForBucket(bucket)) {
      assertEquals(typeof col.label, "string");
      assertEquals(
        col.label.length > 0,
        true,
        `${col.key} should have a label`,
      );
    }
  }
});
