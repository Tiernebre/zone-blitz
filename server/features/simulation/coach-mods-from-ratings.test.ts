import { assertAlmostEquals, assertEquals } from "@std/assert";
import type { CoachRatingValues } from "@zone-blitz/shared";
import { coachRatingsToMods } from "./coach-mods-from-ratings.ts";

function ratings(
  overrides: Partial<CoachRatingValues> = {},
): CoachRatingValues {
  return {
    leadership: 50,
    gameManagement: 50,
    schemeMastery: 50,
    playerDevelopment: 50,
    adaptability: 50,
    ...overrides,
  };
}

Deno.test("rating 50 across the board reproduces the calibration baseline", () => {
  const mods = coachRatingsToMods({
    hc: ratings(),
    oc: ratings(),
    dc: ratings(),
  });
  assertAlmostEquals(mods.schemeFitBonus, 2.5, 1e-9);
  assertAlmostEquals(mods.situationalBonus, 1.5, 1e-9);
  assertEquals(mods.aggressiveness, 50);
  assertAlmostEquals(mods.penaltyDiscipline, 1, 1e-9);
});

Deno.test("missing staff entries default to neutral (50) — baseline preserved", () => {
  const mods = coachRatingsToMods({});
  assertAlmostEquals(mods.schemeFitBonus, 2.5, 1e-9);
  assertAlmostEquals(mods.situationalBonus, 1.5, 1e-9);
  assertEquals(mods.aggressiveness, 50);
  assertAlmostEquals(mods.penaltyDiscipline, 1, 1e-9);
});

Deno.test("elite gameManagement raises aggressiveness symmetrically", () => {
  const elite = coachRatingsToMods({ hc: ratings({ gameManagement: 90 }) });
  const poor = coachRatingsToMods({ hc: ratings({ gameManagement: 10 }) });
  assertEquals(elite.aggressiveness, 66);
  assertEquals(poor.aggressiveness, 34);
});

Deno.test("elite leadership lowers penaltyDiscipline (fewer flags)", () => {
  const elite = coachRatingsToMods({ hc: ratings({ leadership: 90 }) });
  const poor = coachRatingsToMods({ hc: ratings({ leadership: 10 }) });
  // symmetric around 1.0 for inputs equidistant from 50
  assertAlmostEquals(elite.penaltyDiscipline, 0.88, 1e-9);
  assertAlmostEquals(poor.penaltyDiscipline, 1.12, 1e-9);
});

Deno.test("schemeMastery uses OC+DC average", () => {
  const mods = coachRatingsToMods({
    oc: ratings({ schemeMastery: 80 }),
    dc: ratings({ schemeMastery: 80 }),
  });
  // 2.5 + (80-50)*0.05 = 4.0
  assertAlmostEquals(mods.schemeFitBonus, 4, 1e-9);
});

Deno.test("mods stay clamped at the extremes", () => {
  const mods = coachRatingsToMods({
    hc: ratings({ gameManagement: 99, leadership: 99 }),
    oc: ratings({ schemeMastery: 99, adaptability: 99 }),
    dc: ratings({ schemeMastery: 99, adaptability: 99 }),
  });
  assertEquals(mods.aggressiveness <= 70, true);
  assertEquals(mods.schemeFitBonus <= 5, true);
  assertEquals(mods.situationalBonus <= 3, true);
  assertEquals(mods.penaltyDiscipline >= 0.85, true);
});
