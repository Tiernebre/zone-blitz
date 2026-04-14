import { assertEquals } from "@std/assert";
import type {
  CoachTendencies,
  DefensiveTendencies,
  OffensiveTendencies,
} from "@zone-blitz/shared";
import { computeFingerprint } from "./fingerprint.ts";

function offenseVector(): OffensiveTendencies {
  return {
    runPassLean: 40,
    tempo: 50,
    personnelWeight: 55,
    formationUnderCenterShotgun: 30,
    preSnapMotionRate: 80,
    passingStyle: 30,
    passingDepth: 45,
    runGameBlocking: 20,
    rpoIntegration: 30,
  };
}

function defenseVector(): DefensiveTendencies {
  return {
    frontOddEven: 60,
    gapResponsibility: 55,
    subPackageLean: 50,
    coverageManZone: 70,
    coverageShell: 65,
    cornerPressOff: 45,
    pressureRate: 40,
    disguiseRate: 60,
  };
}

function tendencyRow(
  overrides: Partial<CoachTendencies> = {},
): CoachTendencies {
  return {
    coachId: "coach-1",
    offense: null,
    defense: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

Deno.test("computeFingerprint hoists OC offense and DC defense vectors", () => {
  const oc = tendencyRow({ coachId: "oc", offense: offenseVector() });
  const dc = tendencyRow({ coachId: "dc", defense: defenseVector() });
  const fp = computeFingerprint({ oc, dc });
  assertEquals(fp.offense, offenseVector());
  assertEquals(fp.defense, defenseVector());
  assertEquals(fp.overrides, {});
});

Deno.test(
  "computeFingerprint returns null sides when coordinators are vacant",
  () => {
    const fp = computeFingerprint({ oc: null, dc: null });
    assertEquals(fp.offense, null);
    assertEquals(fp.defense, null);
    assertEquals(fp.overrides, {});
  },
);

Deno.test(
  "computeFingerprint tolerates coordinators without tendency data",
  () => {
    const oc = tendencyRow({ coachId: "oc", offense: null });
    const dc = tendencyRow({ coachId: "dc", defense: null });
    const fp = computeFingerprint({ oc, dc });
    assertEquals(fp.offense, null);
    assertEquals(fp.defense, null);
  },
);

Deno.test(
  "computeFingerprint ignores the opposite side of each coordinator's row",
  () => {
    // A DC row that accidentally carries an offense vector (shouldn't
    // happen in practice given the generator, but the function must
    // not read across sides — OC owns offense, DC owns defense).
    const oc = tendencyRow({ coachId: "oc", offense: offenseVector() });
    const dc = tendencyRow({
      coachId: "dc",
      offense: { ...offenseVector(), tempo: 99 },
      defense: defenseVector(),
    });
    const fp = computeFingerprint({ oc, dc });
    assertEquals(fp.offense?.tempo, 50);
    assertEquals(fp.defense, defenseVector());
  },
);

Deno.test(
  "computeFingerprint treats missing coordinator keys the same as null",
  () => {
    const fp = computeFingerprint({});
    assertEquals(fp.offense, null);
    assertEquals(fp.defense, null);
    assertEquals(fp.overrides, {});
  },
);
