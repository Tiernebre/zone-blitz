import { assertAlmostEquals, assertEquals } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { OT_OVERALL_ATTRS, otOverall } from "./ot-overall.ts";

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

Deno.test("OT_OVERALL_ATTRS lists the five OT signature attrs", () => {
  assertEquals(OT_OVERALL_ATTRS.length, 5);
  assertEquals(OT_OVERALL_ATTRS.includes("passBlocking"), true);
  assertEquals(OT_OVERALL_ATTRS.includes("runBlocking"), true);
  assertEquals(OT_OVERALL_ATTRS.includes("strength"), true);
  assertEquals(OT_OVERALL_ATTRS.includes("agility"), true);
  assertEquals(OT_OVERALL_ATTRS.includes("footballIq"), true);
});

Deno.test("otOverall averages the five signature attributes", () => {
  const a = attrs({
    passBlocking: 80,
    runBlocking: 70,
    strength: 60,
    agility: 50,
    footballIq: 40,
  });
  // (80 + 70 + 60 + 50 + 40) / 5 = 60
  assertAlmostEquals(otOverall(a), 60);
});

Deno.test("otOverall returns 50 for a median-50 attribute set", () => {
  assertEquals(otOverall(attrs()), 50);
});

Deno.test("otOverall is invariant to attributes outside the signature set", () => {
  const baseline = otOverall(attrs());
  const tweaked = otOverall(
    attrs({
      speed: 99,
      catching: 99,
      passRushing: 99,
    }),
  );
  assertEquals(baseline, tweaked);
});
