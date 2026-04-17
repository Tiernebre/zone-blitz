import { assertAlmostEquals, assertEquals } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { IOL_OVERALL_ATTRS, iolOverall } from "./iol-overall.ts";

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

Deno.test("iolOverall averages the four signature attributes", () => {
  const result = iolOverall(attrs({
    passBlocking: 60,
    runBlocking: 70,
    strength: 80,
    footballIq: 50,
  }));
  // (60 + 70 + 80 + 50) / 4 = 65
  assertAlmostEquals(result, 65, 1e-6);
});

Deno.test("iolOverall returns 50 for a baseline 50-everything lineman", () => {
  assertEquals(iolOverall(attrs()), 50);
});

Deno.test("IOL_OVERALL_ATTRS covers the blocking ranking + awareness", () => {
  assertEquals(IOL_OVERALL_ATTRS.includes("passBlocking"), true);
  assertEquals(IOL_OVERALL_ATTRS.includes("runBlocking"), true);
  assertEquals(IOL_OVERALL_ATTRS.includes("strength"), true);
  assertEquals(IOL_OVERALL_ATTRS.includes("footballIq"), true);
});
