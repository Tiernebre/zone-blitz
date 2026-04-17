import { assertAlmostEquals, assertEquals } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { S_OVERALL_ATTRS, sOverall } from "./s-overall.ts";

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

Deno.test("sOverall averages the five signature S attributes", () => {
  const result = sOverall(
    attrs({
      zoneCoverage: 70,
      manCoverage: 60,
      speed: 80,
      tackling: 50,
      anticipation: 65,
    }),
  );
  // (70 + 60 + 80 + 50 + 65) / 5 = 65
  assertAlmostEquals(result, 65, 1e-6);
});

Deno.test("sOverall returns the common value when all signature attrs match", () => {
  assertEquals(sOverall(attrs()), 50);
});

Deno.test("S_OVERALL_ATTRS enumerates the five signature attrs in a stable order", () => {
  assertEquals(S_OVERALL_ATTRS.length, 5);
  assertEquals([...S_OVERALL_ATTRS], [
    "zoneCoverage",
    "manCoverage",
    "speed",
    "tackling",
    "anticipation",
  ]);
});
