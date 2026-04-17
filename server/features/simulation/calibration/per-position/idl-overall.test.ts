import { assertAlmostEquals } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { IDL_OVERALL_ATTRS, idlOverall } from "./idl-overall.ts";

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

Deno.test("idlOverall averages the five signature IDL attributes", () => {
  const p = attrs({
    passRushing: 60,
    strength: 70,
    blockShedding: 80,
    runDefense: 50,
    tackling: 40,
  });
  // (60 + 70 + 80 + 50 + 40) / 5 = 60
  assertAlmostEquals(idlOverall(p), 60, 1e-9);
});

Deno.test("idlOverall with all 50s centers on the rating midpoint", () => {
  // Calibration-league players default to 50 on every attribute; the
  // midpoint should map to a 50 overall so the "50 bucket" lines up
  // with the NFL average band.
  const p = attrs();
  assertAlmostEquals(idlOverall(p), 50, 1e-9);
});

Deno.test(
  "IDL_OVERALL_ATTRS covers rush, anchor, and finishing attributes",
  () => {
    const set = new Set<string>(IDL_OVERALL_ATTRS);
    // Rush (passRushing), anchor (strength, blockShedding), run (runDefense),
    // finishing (tackling). Losing any of these should trip this test so a
    // future refactor has to re-justify the composition.
    for (
      const attr of [
        "passRushing",
        "strength",
        "blockShedding",
        "runDefense",
        "tackling",
      ]
    ) {
      if (!set.has(attr)) {
        throw new Error(`IDL_OVERALL_ATTRS is missing ${attr}`);
      }
    }
  },
);
