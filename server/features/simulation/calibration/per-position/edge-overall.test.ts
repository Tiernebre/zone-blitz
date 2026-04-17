import { assertAlmostEquals } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { EDGE_OVERALL_ATTRS, edgeOverall } from "./edge-overall.ts";

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

Deno.test("edgeOverall averages the five signature EDGE attributes", () => {
  const result = edgeOverall(attrs({
    passRushing: 80,
    acceleration: 70,
    strength: 60,
    blockShedding: 50,
    runDefense: 40,
  }));
  // (80 + 70 + 60 + 50 + 40) / 5 = 60
  assertAlmostEquals(result, 60, 1e-9);
});

Deno.test("edgeOverall collapses to 50 when every signature attr is 50", () => {
  assertAlmostEquals(edgeOverall(attrs()), 50, 1e-9);
});

Deno.test("EDGE_OVERALL_ATTRS covers pass-rush and run-defense attributes", () => {
  const asSet = new Set<string>(EDGE_OVERALL_ATTRS);
  // Pass-rush side — matches RANKING_ATTRS.passRush in resolve-matchups.ts
  // so a calibration EDGE overall moves in lockstep with in-sim impact.
  for (const key of ["passRushing", "acceleration", "strength"]) {
    if (!asSet.has(key)) {
      throw new Error(`expected EDGE_OVERALL_ATTRS to include ${key}`);
    }
  }
  // Run-defense side — issue #496 called out blockShedding + runDefense.
  for (const key of ["blockShedding", "runDefense"]) {
    if (!asSet.has(key)) {
      throw new Error(`expected EDGE_OVERALL_ATTRS to include ${key}`);
    }
  }
});
