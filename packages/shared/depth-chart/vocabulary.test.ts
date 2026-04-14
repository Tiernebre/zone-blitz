import { assertEquals } from "@std/assert";
import type { SchemeFingerprint } from "../types/scheme-fingerprint.ts";
import type { OffensiveTendencies } from "../types/coach-tendencies.ts";
import type { DefensiveTendencies } from "../types/coach-tendencies.ts";
import {
  type DepthChartSlotDefinition,
  depthChartVocabulary,
} from "./vocabulary.ts";

function codes(defs: DepthChartSlotDefinition[]): string[] {
  return defs.map((d) => d.code);
}

function codesForGroup(
  defs: DepthChartSlotDefinition[],
  group: DepthChartSlotDefinition["group"],
): string[] {
  return defs.filter((d) => d.group === group).map((d) => d.code);
}

const BASE_OFFENSE: OffensiveTendencies = {
  runPassLean: 50,
  tempo: 50,
  personnelWeight: 50,
  formationUnderCenterShotgun: 50,
  preSnapMotionRate: 50,
  passingStyle: 50,
  passingDepth: 50,
  runGameBlocking: 50,
  rpoIntegration: 50,
};

const BASE_DEFENSE: DefensiveTendencies = {
  frontOddEven: 50,
  gapResponsibility: 50,
  subPackageLean: 50,
  coverageManZone: 50,
  coverageShell: 50,
  cornerPressOff: 50,
  pressureRate: 50,
  disguiseRate: 50,
};

function fp(
  overrides?: {
    offense?: Partial<OffensiveTendencies> | null;
    defense?: Partial<DefensiveTendencies> | null;
  },
): SchemeFingerprint {
  return {
    offense: overrides?.offense === null
      ? null
      : { ...BASE_OFFENSE, ...overrides?.offense },
    defense: overrides?.defense === null
      ? null
      : { ...BASE_DEFENSE, ...overrides?.defense },
    overrides: {},
  };
}

Deno.test("depthChartVocabulary: null fingerprint returns legacy default set", () => {
  const vocab = depthChartVocabulary({
    offense: null,
    defense: null,
    overrides: {},
  });
  assertEquals(codes(vocab), [
    "QB",
    "RB",
    "FB",
    "WR",
    "TE",
    "OL",
    "DL",
    "LB",
    "CB",
    "S",
    "K",
    "P",
    "LS",
  ]);
});

Deno.test("depthChartVocabulary: special teams slots are always K, P, LS", () => {
  const vocab = depthChartVocabulary(fp());
  assertEquals(codesForGroup(vocab, "special_teams"), ["K", "P", "LS"]);
});

Deno.test("depthChartVocabulary: offense with balanced personnelWeight has no FB", () => {
  const vocab = depthChartVocabulary(fp({ offense: { personnelWeight: 50 } }));
  const offCodes = codesForGroup(vocab, "offense");
  assertEquals(offCodes.includes("FB"), false);
  assertEquals(offCodes.includes("QB"), true);
  assertEquals(offCodes.includes("RB"), true);
  assertEquals(offCodes.includes("WR"), true);
  assertEquals(offCodes.includes("TE"), true);
});

Deno.test("depthChartVocabulary: offense with light personnelWeight has no FB, has split OL", () => {
  const vocab = depthChartVocabulary(fp({ offense: { personnelWeight: 20 } }));
  const offCodes = codesForGroup(vocab, "offense");
  assertEquals(offCodes.includes("FB"), false);
  assertEquals(offCodes.includes("OL"), false);
  assertEquals(offCodes.includes("LT"), true);
  assertEquals(offCodes.includes("LG"), true);
  assertEquals(offCodes.includes("C"), true);
  assertEquals(offCodes.includes("RG"), true);
  assertEquals(offCodes.includes("RT"), true);
});

Deno.test("depthChartVocabulary: offense with heavy personnelWeight includes FB", () => {
  const vocab = depthChartVocabulary(fp({ offense: { personnelWeight: 80 } }));
  const offCodes = codesForGroup(vocab, "offense");
  assertEquals(offCodes.includes("FB"), true);
  assertEquals(offCodes.includes("RB"), true);
  assertEquals(offCodes.includes("WR"), true);
  assertEquals(offCodes.includes("TE"), true);
});

Deno.test("depthChartVocabulary: offense with personnelWeight at boundary 66 includes FB", () => {
  const vocab = depthChartVocabulary(fp({ offense: { personnelWeight: 66 } }));
  const offCodes = codesForGroup(vocab, "offense");
  assertEquals(offCodes.includes("FB"), true);
});

Deno.test("depthChartVocabulary: offense with personnelWeight 65 has no FB", () => {
  const vocab = depthChartVocabulary(fp({ offense: { personnelWeight: 65 } }));
  const offCodes = codesForGroup(vocab, "offense");
  assertEquals(offCodes.includes("FB"), false);
});

Deno.test("depthChartVocabulary: 4-3 defense (frontOddEven low) has DE and DT", () => {
  const vocab = depthChartVocabulary(fp({ defense: { frontOddEven: 20 } }));
  const defCodes = codesForGroup(vocab, "defense");
  assertEquals(defCodes.includes("DE"), true);
  assertEquals(defCodes.includes("DT"), true);
  assertEquals(defCodes.includes("LB"), true);
  assertEquals(defCodes.includes("CB"), true);
  assertEquals(defCodes.includes("S"), true);
  assertEquals(defCodes.includes("NT"), false);
  assertEquals(defCodes.includes("OLB"), false);
  assertEquals(defCodes.includes("ILB"), false);
});

Deno.test("depthChartVocabulary: 3-4 defense (frontOddEven high) has OLB, DE, NT, ILB", () => {
  const vocab = depthChartVocabulary(fp({ defense: { frontOddEven: 70 } }));
  const defCodes = codesForGroup(vocab, "defense");
  assertEquals(defCodes.includes("OLB"), true);
  assertEquals(defCodes.includes("DE"), true);
  assertEquals(defCodes.includes("NT"), true);
  assertEquals(defCodes.includes("ILB"), true);
  assertEquals(defCodes.includes("CB"), true);
  assertEquals(defCodes.includes("S"), true);
  assertEquals(defCodes.includes("DT"), false);
  assertEquals(defCodes.includes("LB"), false);
});

Deno.test("depthChartVocabulary: hybrid defense (frontOddEven mid) uses EDGE, DL, LB", () => {
  const vocab = depthChartVocabulary(fp({ defense: { frontOddEven: 50 } }));
  const defCodes = codesForGroup(vocab, "defense");
  assertEquals(defCodes.includes("EDGE"), true);
  assertEquals(defCodes.includes("DL"), true);
  assertEquals(defCodes.includes("LB"), true);
  assertEquals(defCodes.includes("CB"), true);
  assertEquals(defCodes.includes("S"), true);
});

Deno.test("depthChartVocabulary: sub-package heavy defense adds NCB", () => {
  const vocab = depthChartVocabulary(
    fp({ defense: { frontOddEven: 20, subPackageLean: 70 } }),
  );
  const defCodes = codesForGroup(vocab, "defense");
  assertEquals(defCodes.includes("NCB"), true);
});

Deno.test("depthChartVocabulary: base-heavy defense has no NCB", () => {
  const vocab = depthChartVocabulary(
    fp({ defense: { frontOddEven: 20, subPackageLean: 30 } }),
  );
  const defCodes = codesForGroup(vocab, "defense");
  assertEquals(defCodes.includes("NCB"), false);
});

Deno.test("depthChartVocabulary: offense only (no DC) uses default defense", () => {
  const vocab = depthChartVocabulary(fp({ defense: null }));
  const defCodes = codesForGroup(vocab, "defense");
  assertEquals(defCodes, ["DL", "LB", "CB", "S"]);
});

Deno.test("depthChartVocabulary: defense only (no OC) uses default offense", () => {
  const vocab = depthChartVocabulary(fp({ offense: null }));
  const offCodes = codesForGroup(vocab, "offense");
  assertEquals(offCodes, ["QB", "RB", "FB", "WR", "TE", "OL"]);
});

Deno.test("depthChartVocabulary: every definition has a non-empty label", () => {
  const vocab = depthChartVocabulary(fp());
  for (const def of vocab) {
    assertEquals(def.label.length > 0, true, `empty label for ${def.code}`);
  }
});

Deno.test("depthChartVocabulary: no duplicate codes", () => {
  const vocab = depthChartVocabulary(fp());
  const codeSet = new Set(codes(vocab));
  assertEquals(codeSet.size, vocab.length);
});

Deno.test("depthChartVocabulary: full spread team snapshot", () => {
  const vocab = depthChartVocabulary(
    fp({
      offense: { personnelWeight: 15 },
      defense: { frontOddEven: 30, subPackageLean: 70 },
    }),
  );
  assertEquals(codes(vocab), [
    "QB",
    "RB",
    "WR",
    "TE",
    "LT",
    "LG",
    "C",
    "RG",
    "RT",
    "DE",
    "DT",
    "LB",
    "CB",
    "NCB",
    "S",
    "K",
    "P",
    "LS",
  ]);
});

Deno.test("depthChartVocabulary: full ground-and-pound team snapshot", () => {
  const vocab = depthChartVocabulary(
    fp({
      offense: { personnelWeight: 80 },
      defense: { frontOddEven: 75, subPackageLean: 25 },
    }),
  );
  assertEquals(codes(vocab), [
    "QB",
    "RB",
    "FB",
    "WR",
    "TE",
    "LT",
    "LG",
    "C",
    "RG",
    "RT",
    "OLB",
    "DE",
    "NT",
    "ILB",
    "CB",
    "S",
    "K",
    "P",
    "LS",
  ]);
});
