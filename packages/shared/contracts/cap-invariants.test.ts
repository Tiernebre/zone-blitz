import { assertEquals } from "@std/assert";
import {
  type CapBonusProration,
  type CapContractInput,
  type CapContractYear,
  computeCapHit,
  computeDeadCap,
  restructureContract,
} from "./cap-engine.ts";
import type { ContractGuaranteeType } from "../types/player.ts";

function makeYear(
  leagueYear: number,
  base: number,
  overrides: Partial<CapContractYear> = {},
): CapContractYear {
  return {
    leagueYear,
    base,
    rosterBonus: 0,
    workoutBonus: 0,
    perGameRosterBonus: 0,
    guaranteeType: "none",
    isVoid: false,
    ...overrides,
  };
}

function makeContract(
  overrides: Partial<CapContractInput> = {},
): CapContractInput {
  return {
    years: [],
    bonusProrations: [],
    optionBonuses: [],
    ...overrides,
  };
}

function totalContractValue(contract: CapContractInput): number {
  const yearlyCash = contract.years.reduce(
    (sum, y) =>
      sum + y.base + y.rosterBonus + y.workoutBonus + y.perGameRosterBonus,
    0,
  );
  const bonusFace = contract.bonusProrations.reduce(
    (sum, p) => sum + p.amount,
    0,
  );
  return yearlyCash + bonusFace;
}

function assertCapHitSumInvariant(contract: CapContractInput): void {
  const capHitSum = contract.years.reduce(
    (sum, y) => sum + computeCapHit(contract, y.leagueYear),
    0,
  );
  assertEquals(
    capHitSum,
    totalContractValue(contract),
    `Invariant 1 violated: sum(capHits)=${capHitSum} != totalContractValue=${
      totalContractValue(contract)
    }`,
  );
}

function assertDeadCapReconciliation(
  contract: CapContractInput,
  cutYear: number,
): void {
  const deadCap = computeDeadCap(contract, cutYear);
  const remainingCapHits = contract.years
    .filter((y) => y.leagueYear >= cutYear)
    .reduce((sum, y) => sum + computeCapHit(contract, y.leagueYear), 0);
  const escapable = contract.years
    .filter((y) => y.leagueYear >= cutYear && !y.isVoid)
    .reduce((sum, y) => {
      let esc = y.workoutBonus + y.perGameRosterBonus;
      if (y.guaranteeType !== "full") {
        esc += y.base + y.rosterBonus;
      }
      return sum + esc;
    }, 0);
  assertEquals(
    deadCap + escapable,
    remainingCapHits,
    `Invariant 2 violated at cutYear=${cutYear}: deadCap(${deadCap}) + escapable(${escapable}) != remainingCapHits(${remainingCapHits})`,
  );
}

function assertBothInvariants(contract: CapContractInput): void {
  assertCapHitSumInvariant(contract);
  for (const y of contract.years) {
    assertDeadCapReconciliation(contract, y.leagueYear);
  }
}

// ---------- Invariant 1: sum(capHits) == totalContractValue ----------

Deno.test("invariant 1: simple 1-year contract", () => {
  const contract = makeContract({
    years: [makeYear(2024, 5_000_000)],
  });
  assertCapHitSumInvariant(contract);
});

Deno.test("invariant 1: multi-year with signing bonus proration", () => {
  const contract = makeContract({
    years: [
      makeYear(2024, 3_000_000),
      makeYear(2025, 3_000_000),
      makeYear(2026, 3_000_000),
    ],
    bonusProrations: [
      { amount: 9_000_000, firstYear: 2024, years: 3, source: "signing" },
    ],
  });
  assertCapHitSumInvariant(contract);
});

Deno.test("invariant 1: proration with rounding residue", () => {
  const contract = makeContract({
    years: [
      makeYear(2024, 1_000_000),
      makeYear(2025, 1_000_000),
      makeYear(2026, 1_000_000),
    ],
    bonusProrations: [
      { amount: 10_000_000, firstYear: 2024, years: 3, source: "signing" },
    ],
  });
  assertCapHitSumInvariant(contract);
});

Deno.test("invariant 1: contract with void years", () => {
  const contract = makeContract({
    years: [
      makeYear(2024, 8_000_000, { guaranteeType: "full" }),
      makeYear(2025, 0, { isVoid: true }),
      makeYear(2026, 0, { isVoid: true }),
    ],
    bonusProrations: [
      { amount: 15_000_000, firstYear: 2024, years: 3, source: "signing" },
    ],
  });
  assertCapHitSumInvariant(contract);
});

Deno.test("invariant 1: contract with all bonus types", () => {
  const contract = makeContract({
    years: [
      makeYear(2024, 5_000_000, {
        rosterBonus: 2_000_000,
        workoutBonus: 500_000,
        perGameRosterBonus: 1_000_000,
        guaranteeType: "full",
      }),
      makeYear(2025, 6_000_000, {
        rosterBonus: 1_500_000,
        workoutBonus: 500_000,
        perGameRosterBonus: 1_000_000,
      }),
    ],
    bonusProrations: [
      { amount: 12_000_000, firstYear: 2024, years: 2, source: "signing" },
    ],
  });
  assertCapHitSumInvariant(contract);
});

Deno.test("invariant 1: multiple proration slices (signing + restructure)", () => {
  const contract = makeContract({
    years: [
      makeYear(2024, 10_000_000),
      makeYear(2025, 8_000_000),
      makeYear(2026, 6_000_000),
      makeYear(2027, 4_000_000),
    ],
    bonusProrations: [
      { amount: 20_000_000, firstYear: 2024, years: 4, source: "signing" },
      { amount: 6_000_000, firstYear: 2025, years: 3, source: "restructure" },
    ],
  });
  assertCapHitSumInvariant(contract);
});

Deno.test("invariant 1: franchise tag (1-year, no proration)", () => {
  const contract = makeContract({
    years: [
      makeYear(2024, 32_000_000, { guaranteeType: "full" }),
    ],
  });
  assertCapHitSumInvariant(contract);
});

// ---------- Invariant 2: dead-cap reconciliation ----------

Deno.test("invariant 2: simple contract, cut in first year", () => {
  const contract = makeContract({
    years: [
      makeYear(2024, 5_000_000, { guaranteeType: "full" }),
      makeYear(2025, 5_000_000),
    ],
    bonusProrations: [
      { amount: 10_000_000, firstYear: 2024, years: 2, source: "signing" },
    ],
  });
  assertDeadCapReconciliation(contract, 2024);
  assertDeadCapReconciliation(contract, 2025);
});

Deno.test("invariant 2: cut with void years", () => {
  const contract = makeContract({
    years: [
      makeYear(2024, 8_000_000, { guaranteeType: "full" }),
      makeYear(2025, 0, { isVoid: true }),
      makeYear(2026, 0, { isVoid: true }),
    ],
    bonusProrations: [
      { amount: 15_000_000, firstYear: 2024, years: 3, source: "signing" },
    ],
  });
  for (const y of contract.years) {
    assertDeadCapReconciliation(contract, y.leagueYear);
  }
});

Deno.test("invariant 2: mixed guarantee types", () => {
  const contract = makeContract({
    years: [
      makeYear(2024, 10_000_000, { guaranteeType: "full" }),
      makeYear(2025, 10_000_000, { guaranteeType: "full" }),
      makeYear(2026, 10_000_000, { guaranteeType: "injury" }),
      makeYear(2027, 10_000_000),
    ],
    bonusProrations: [
      { amount: 20_000_000, firstYear: 2024, years: 4, source: "signing" },
    ],
  });
  for (const y of contract.years) {
    assertDeadCapReconciliation(contract, y.leagueYear);
  }
});

Deno.test("invariant 2: contract with PGRB and workout bonuses", () => {
  const contract = makeContract({
    years: [
      makeYear(2024, 5_000_000, {
        rosterBonus: 2_000_000,
        workoutBonus: 500_000,
        perGameRosterBonus: 1_500_000,
        guaranteeType: "full",
      }),
      makeYear(2025, 6_000_000, {
        rosterBonus: 1_000_000,
        workoutBonus: 500_000,
        perGameRosterBonus: 1_000_000,
      }),
      makeYear(2026, 7_000_000, {
        workoutBonus: 500_000,
        perGameRosterBonus: 850_000,
      }),
    ],
    bonusProrations: [
      { amount: 18_000_000, firstYear: 2024, years: 3, source: "signing" },
    ],
  });
  for (const y of contract.years) {
    assertDeadCapReconciliation(contract, y.leagueYear);
  }
});

Deno.test("invariant 2: no proration, all guaranteed", () => {
  const contract = makeContract({
    years: [
      makeYear(2024, 10_000_000, { guaranteeType: "full" }),
      makeYear(2025, 12_000_000, { guaranteeType: "full" }),
    ],
  });
  for (const y of contract.years) {
    assertDeadCapReconciliation(contract, y.leagueYear);
  }
});

Deno.test("invariant 2: franchise tag (single year, fully guaranteed)", () => {
  const contract = makeContract({
    years: [
      makeYear(2024, 32_000_000, { guaranteeType: "full" }),
    ],
  });
  assertDeadCapReconciliation(contract, 2024);
});

// ---------- Both invariants: representative sweep ----------

interface ContractSpec {
  label: string;
  years: CapContractYear[];
  bonusProrations: CapBonusProration[];
}

function rookieContract(draftPick: number, signedYear: number): ContractSpec {
  const SLOTTED_MAX = 40_000_000;
  const SLOTTED_MIN = 4_000_000;
  const MAX_PICK = 224;
  const normalized = Math.max(
    0,
    Math.min(1, (draftPick - 1) / (MAX_PICK - 1)),
  );
  const factor = Math.pow(1 - normalized, 1.5);
  const totalValue = Math.round(
    SLOTTED_MIN + (SLOTTED_MAX - SLOTTED_MIN) * factor,
  );
  const BONUS_RATIO = 0.15;
  const DEAL_YEARS = 4;
  const signingBonus = Math.round(totalValue * BONUS_RATIO);
  const remainingBase = totalValue - signingBonus;
  const annualBase = Math.max(1, Math.floor(remainingBase / DEAL_YEARS));
  const residue = remainingBase - annualBase * DEAL_YEARS;

  const years: CapContractYear[] = [];
  for (let i = 0; i < DEAL_YEARS; i++) {
    years.push(
      makeYear(
        signedYear + i,
        annualBase + (i === DEAL_YEARS - 1 ? residue : 0),
        {
          guaranteeType: i < 2 ? "full" : "none",
        },
      ),
    );
  }

  const bonusProrations: CapBonusProration[] = signingBonus > 0
    ? [{
      amount: signingBonus,
      firstYear: signedYear,
      years: Math.min(DEAL_YEARS, 5),
      source: "signing",
    }]
    : [];

  return { label: `rookie pick #${draftPick}`, years, bonusProrations };
}

function veteranContract(
  annualBase: number,
  realYears: number,
  bonusRatio: number,
  voidYears: number,
  guaranteedYears: number,
  signedYear: number,
): ContractSpec {
  const totalYears = realYears + voidYears;
  const totalValue = annualBase * realYears;
  const signingBonus = Math.round(totalValue * bonusRatio);
  const remainingBase = totalValue - signingBonus;
  const perYearBase = Math.max(1, Math.floor(remainingBase / realYears));
  const baseResidue = remainingBase - perYearBase * realYears;

  const years: CapContractYear[] = [];
  for (let i = 0; i < realYears; i++) {
    const guaranteeType: ContractGuaranteeType = i < guaranteedYears
      ? "full"
      : "none";
    years.push(
      makeYear(
        signedYear + i,
        perYearBase + (i === realYears - 1 ? baseResidue : 0),
        {
          guaranteeType,
        },
      ),
    );
  }
  for (let i = 0; i < voidYears; i++) {
    years.push(makeYear(signedYear + realYears + i, 0, { isVoid: true }));
  }

  const bonusProrations: CapBonusProration[] = signingBonus > 0
    ? [{
      amount: signingBonus,
      firstYear: signedYear,
      years: Math.min(totalYears, 5),
      source: "signing",
    }]
    : [];

  return {
    label: `vet ${realYears}yr+${voidYears}void bonus=${
      (bonusRatio * 100).toFixed(0)
    }%`,
    years,
    bonusProrations,
  };
}

const SWEEP: ContractSpec[] = [
  rookieContract(1, 2024),
  rookieContract(32, 2024),
  rookieContract(100, 2024),
  rookieContract(224, 2024),
  // flush archetype: low bonus, no voids
  veteranContract(5_000_000, 3, 0.10, 0, 1, 2024),
  veteranContract(15_000_000, 4, 0.20, 0, 2, 2024),
  // balanced archetype: moderate bonus, occasional void
  veteranContract(8_000_000, 3, 0.35, 1, 1, 2024),
  veteranContract(20_000_000, 5, 0.40, 1, 3, 2024),
  // tight archetype: higher bonus
  veteranContract(12_000_000, 3, 0.45, 1, 2, 2024),
  veteranContract(25_000_000, 4, 0.50, 1, 2, 2024),
  // cap-hell archetype: high bonus, more voids
  veteranContract(10_000_000, 2, 0.55, 2, 1, 2024),
  veteranContract(30_000_000, 3, 0.60, 2, 2, 2024),
  veteranContract(35_000_000, 5, 0.65, 2, 3, 2024),
  // edge cases
  veteranContract(750_000, 1, 0.0, 0, 1, 2024),
  veteranContract(750_000, 2, 0.0, 0, 0, 2024),
  veteranContract(50_000_000, 5, 0.50, 0, 5, 2024),
];

for (const spec of SWEEP) {
  Deno.test(`invariant sweep (${spec.label}): both invariants hold`, () => {
    const contract = makeContract({
      years: spec.years,
      bonusProrations: spec.bonusProrations,
    });
    assertBothInvariants(contract);
  });
}

// ---------- Restructure preserves both invariants ----------

Deno.test("restructure preserves invariant 1: cap-hit sum unchanged", () => {
  for (const spec of SWEEP) {
    const contract = makeContract({
      years: spec.years,
      bonusProrations: spec.bonusProrations,
    });
    const realYears = contract.years.filter((y) => !y.isVoid);
    if (realYears.length < 2) continue;

    const targetYear = realYears[0].leagueYear;
    const restructureAmount = Math.floor(realYears[0].base * 0.5);
    if (restructureAmount <= 0) continue;

    const restructured = restructureContract(
      contract,
      targetYear,
      restructureAmount,
    );

    assertCapHitSumInvariant(contract);
    assertCapHitSumInvariant(restructured);

    const totalBefore = contract.years.reduce(
      (sum, y) => sum + computeCapHit(contract, y.leagueYear),
      0,
    );
    const totalAfter = restructured.years.reduce(
      (sum, y) => sum + computeCapHit(restructured, y.leagueYear),
      0,
    );
    assertEquals(
      totalBefore,
      totalAfter,
      `Restructure broke invariant 1 for ${spec.label}: before=${totalBefore} after=${totalAfter}`,
    );
  }
});

Deno.test("restructure preserves invariant 2: dead-cap reconciliation", () => {
  for (const spec of SWEEP) {
    const contract = makeContract({
      years: spec.years,
      bonusProrations: spec.bonusProrations,
    });
    const realYears = contract.years.filter((y) => !y.isVoid);
    if (realYears.length < 2) continue;

    const targetYear = realYears[0].leagueYear;
    const restructureAmount = Math.floor(realYears[0].base * 0.5);
    if (restructureAmount <= 0) continue;

    const restructured = restructureContract(
      contract,
      targetYear,
      restructureAmount,
    );

    for (const y of restructured.years) {
      assertDeadCapReconciliation(restructured, y.leagueYear);
    }
  }
});

Deno.test("restructure in middle year preserves both invariants", () => {
  const contract = makeContract({
    years: [
      makeYear(2024, 15_000_000, { guaranteeType: "full" }),
      makeYear(2025, 15_000_000, { guaranteeType: "full" }),
      makeYear(2026, 12_000_000),
      makeYear(2027, 10_000_000),
    ],
    bonusProrations: [
      { amount: 20_000_000, firstYear: 2024, years: 4, source: "signing" },
    ],
  });

  const restructured = restructureContract(contract, 2026, 8_000_000);
  assertBothInvariants(contract);
  assertBothInvariants(restructured);
});

Deno.test("double restructure preserves both invariants", () => {
  const contract = makeContract({
    years: [
      makeYear(2024, 20_000_000, { guaranteeType: "full" }),
      makeYear(2025, 18_000_000, { guaranteeType: "full" }),
      makeYear(2026, 15_000_000),
      makeYear(2027, 12_000_000),
      makeYear(2028, 10_000_000),
    ],
    bonusProrations: [
      { amount: 25_000_000, firstYear: 2024, years: 5, source: "signing" },
    ],
  });

  const after1 = restructureContract(contract, 2025, 10_000_000);
  const after2 = restructureContract(after1, 2026, 8_000_000);

  assertBothInvariants(contract);
  assertBothInvariants(after1);
  assertBothInvariants(after2);
});

// ---------- Option exercise preserves both invariants ----------

Deno.test("exercised option bonus preserves invariant 1", () => {
  const contract = makeContract({
    years: [
      makeYear(2024, 5_000_000, { guaranteeType: "full" }),
      makeYear(2025, 5_000_000),
      makeYear(2026, 5_000_000),
      makeYear(2027, 5_000_000),
    ],
    bonusProrations: [
      { amount: 10_000_000, firstYear: 2024, years: 4, source: "signing" },
    ],
    optionBonuses: [
      {
        amount: 20_000_000,
        exerciseYear: 2025,
        prorationYears: 3,
        exercisedAt: null,
      },
    ],
  });
  assertCapHitSumInvariant(contract);

  const exercised: CapContractInput = {
    ...contract,
    bonusProrations: [
      ...contract.bonusProrations,
      { amount: 20_000_000, firstYear: 2025, years: 3, source: "option" },
    ],
    optionBonuses: [
      {
        ...contract.optionBonuses[0],
        exercisedAt: new Date("2025-03-01"),
      },
    ],
  };
  assertCapHitSumInvariant(exercised);
});

Deno.test("exercised option bonus preserves invariant 2", () => {
  const contract = makeContract({
    years: [
      makeYear(2024, 5_000_000, { guaranteeType: "full" }),
      makeYear(2025, 5_000_000),
      makeYear(2026, 5_000_000),
      makeYear(2027, 5_000_000),
    ],
    bonusProrations: [
      { amount: 10_000_000, firstYear: 2024, years: 4, source: "signing" },
    ],
    optionBonuses: [
      {
        amount: 20_000_000,
        exerciseYear: 2025,
        prorationYears: 3,
        exercisedAt: null,
      },
    ],
  });

  const exercised: CapContractInput = {
    ...contract,
    bonusProrations: [
      ...contract.bonusProrations,
      { amount: 20_000_000, firstYear: 2025, years: 3, source: "option" },
    ],
    optionBonuses: [
      {
        ...contract.optionBonuses[0],
        exercisedAt: new Date("2025-03-01"),
      },
    ],
  };

  for (const y of exercised.years) {
    assertDeadCapReconciliation(exercised, y.leagueYear);
  }
});

// ---------- Restructure + option exercise combined ----------

Deno.test("restructure after option exercise preserves both invariants", () => {
  const base: CapContractInput = makeContract({
    years: [
      makeYear(2024, 10_000_000, { guaranteeType: "full" }),
      makeYear(2025, 10_000_000, { guaranteeType: "full" }),
      makeYear(2026, 10_000_000),
      makeYear(2027, 10_000_000),
    ],
    bonusProrations: [
      { amount: 15_000_000, firstYear: 2024, years: 4, source: "signing" },
    ],
    optionBonuses: [
      {
        amount: 12_000_000,
        exerciseYear: 2025,
        prorationYears: 3,
        exercisedAt: null,
      },
    ],
  });

  const exercised: CapContractInput = {
    ...base,
    bonusProrations: [
      ...base.bonusProrations,
      { amount: 12_000_000, firstYear: 2025, years: 3, source: "option" },
    ],
    optionBonuses: [
      { ...base.optionBonuses[0], exercisedAt: new Date("2025-03-01") },
    ],
  };

  const restructured = restructureContract(exercised, 2026, 5_000_000);

  assertBothInvariants(base);
  assertBothInvariants(exercised);
  assertBothInvariants(restructured);
});
