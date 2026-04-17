import { assertAlmostEquals, assertEquals } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { LB_OVERALL_ATTRS, lbOverall } from "./lb-overall.ts";

function attrs(overrides: Partial<PlayerAttributes> = {}): PlayerAttributes {
  const base: Record<string, number> = {};
  const keys = [
    "speed",
    "acceleration",
    "agility",
    "strength",
    "jumping",
    "stamina",
    "durability",
    "armStrength",
    "accuracyShort",
    "accuracyMedium",
    "accuracyDeep",
    "accuracyOnTheRun",
    "touch",
    "release",
    "ballCarrying",
    "elusiveness",
    "routeRunning",
    "catching",
    "contestedCatching",
    "runAfterCatch",
    "passBlocking",
    "runBlocking",
    "blockShedding",
    "tackling",
    "manCoverage",
    "zoneCoverage",
    "passRushing",
    "runDefense",
    "kickingPower",
    "kickingAccuracy",
    "puntingPower",
    "puntingAccuracy",
    "snapAccuracy",
    "footballIq",
    "decisionMaking",
    "anticipation",
    "composure",
    "clutch",
    "consistency",
    "workEthic",
    "coachability",
    "leadership",
    "greed",
    "loyalty",
    "ambition",
    "vanity",
    "schemeAttachment",
    "mediaSensitivity",
  ];
  for (const k of keys) {
    base[k] = 50;
    base[`${k}Potential`] = 50;
  }
  return { ...(base as unknown as PlayerAttributes), ...overrides };
}

Deno.test("lbOverall returns the 50 midpoint for an all-50 player", () => {
  assertEquals(lbOverall(attrs()), 50);
});

Deno.test("lbOverall averages the six signature attributes only", () => {
  const player = attrs({
    blockShedding: 60,
    tackling: 70,
    runDefense: 80,
    zoneCoverage: 40,
    footballIq: 55,
    anticipation: 65,
    // Non-signature attributes should not move the overall.
    speed: 99,
    strength: 99,
    manCoverage: 99,
  });
  // (60 + 70 + 80 + 40 + 55 + 65) / 6 = 61.6667
  assertAlmostEquals(lbOverall(player), 61.6667, 0.001);
});

Deno.test("LB_OVERALL_ATTRS is stable and exactly six attributes", () => {
  assertEquals(LB_OVERALL_ATTRS.length, 6);
  assertEquals(LB_OVERALL_ATTRS.includes("blockShedding"), true);
  assertEquals(LB_OVERALL_ATTRS.includes("tackling"), true);
  assertEquals(LB_OVERALL_ATTRS.includes("runDefense"), true);
  assertEquals(LB_OVERALL_ATTRS.includes("zoneCoverage"), true);
  assertEquals(LB_OVERALL_ATTRS.includes("footballIq"), true);
  assertEquals(LB_OVERALL_ATTRS.includes("anticipation"), true);
});
