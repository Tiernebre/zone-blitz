import { assertAlmostEquals, assertEquals } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { WR_OVERALL_ATTRS, wrOverall } from "./wr-overall.ts";

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

Deno.test("wrOverall averages the four signature WR attributes", () => {
  const result = wrOverall(
    attrs({
      routeRunning: 60,
      catching: 70,
      speed: 80,
      release: 50,
    }),
  );
  // (60 + 70 + 80 + 50) / 4 = 65
  assertAlmostEquals(result, 65, 1e-6);
});

Deno.test("wrOverall returns the common value when all signature attrs match", () => {
  assertEquals(wrOverall(attrs()), 50);
});

Deno.test("WR_OVERALL_ATTRS enumerates the four signature attrs in a stable order", () => {
  assertEquals(WR_OVERALL_ATTRS.length, 4);
  assertEquals([...WR_OVERALL_ATTRS], [
    "routeRunning",
    "catching",
    "speed",
    "release",
  ]);
});
