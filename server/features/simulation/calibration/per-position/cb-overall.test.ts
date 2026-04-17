import { assertAlmostEquals, assertEquals } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { CB_OVERALL_ATTRS, cbOverall } from "./cb-overall.ts";

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

Deno.test("CB_OVERALL_ATTRS covers the coverage + athleticism signature", () => {
  assertEquals(CB_OVERALL_ATTRS.length, 4);
  assertEquals(CB_OVERALL_ATTRS.includes("manCoverage"), true);
  assertEquals(CB_OVERALL_ATTRS.includes("zoneCoverage"), true);
  assertEquals(CB_OVERALL_ATTRS.includes("speed"), true);
  assertEquals(CB_OVERALL_ATTRS.includes("agility"), true);
});

Deno.test("cbOverall averages the four signature attrs", () => {
  const a = attrs({
    manCoverage: 60,
    zoneCoverage: 70,
    speed: 80,
    agility: 50,
  });
  // (60 + 70 + 80 + 50) / 4 = 65
  assertAlmostEquals(cbOverall(a), 65, 0.0001);
});

Deno.test("cbOverall ignores non-signature attrs", () => {
  const a = attrs({
    manCoverage: 50,
    zoneCoverage: 50,
    speed: 50,
    agility: 50,
    tackling: 99,
    passRushing: 99,
  });
  assertAlmostEquals(cbOverall(a), 50, 0.0001);
});
