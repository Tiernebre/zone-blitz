import { assertEquals } from "@std/assert";
import {
  type CapContractInput,
  computeCapHit,
  computeDeadCap,
  computeHeadlineValue,
  restructureContract,
} from "./cap-engine.ts";

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

// ---------- computeCapHit ----------

Deno.test("computeCapHit: returns 0 for a year not in the contract", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2024,
        base: 1_000_000,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "none",
        isVoid: false,
      },
    ],
  });
  assertEquals(computeCapHit(contract, 2025), 0);
});

Deno.test("computeCapHit: sums base, roster, workout, and PGRB for a real year", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2024,
        base: 5_000_000,
        rosterBonus: 1_000_000,
        workoutBonus: 500_000,
        perGameRosterBonus: 850_000,
        guaranteeType: "full",
        isVoid: false,
      },
    ],
  });
  assertEquals(computeCapHit(contract, 2024), 7_350_000);
});

Deno.test("computeCapHit: includes prorated signing bonus", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2024,
        base: 1_000_000,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "none",
        isVoid: false,
      },
      {
        leagueYear: 2025,
        base: 1_000_000,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "none",
        isVoid: false,
      },
    ],
    bonusProrations: [
      { amount: 10_000_000, firstYear: 2024, years: 5, source: "signing" },
    ],
  });
  // 1_000_000 base + floor(10_000_000 / 5) = 1_000_000 + 2_000_000
  assertEquals(computeCapHit(contract, 2024), 3_000_000);
  assertEquals(computeCapHit(contract, 2025), 3_000_000);
});

Deno.test("computeCapHit: void years return only proration", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2024,
        base: 5_000_000,
        rosterBonus: 1_000_000,
        workoutBonus: 500_000,
        perGameRosterBonus: 200_000,
        guaranteeType: "full",
        isVoid: false,
      },
      {
        leagueYear: 2025,
        base: 0,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "none",
        isVoid: true,
      },
    ],
    bonusProrations: [
      { amount: 4_000_000, firstYear: 2024, years: 2, source: "signing" },
    ],
  });
  assertEquals(computeCapHit(contract, 2025), 2_000_000);
});

Deno.test("computeCapHit: sums multiple proration slices (signing + restructure)", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2025,
        base: 2_000_000,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "none",
        isVoid: false,
      },
    ],
    bonusProrations: [
      { amount: 10_000_000, firstYear: 2024, years: 5, source: "signing" },
      { amount: 5_000_000, firstYear: 2025, years: 3, source: "restructure" },
    ],
  });
  // base + floor(10M/5) + floor(5M/3)
  // 2_000_000 + 2_000_000 + 1_666_666 = 5_666_666
  assertEquals(computeCapHit(contract, 2025), 5_666_666);
});

Deno.test("computeCapHit: excludes proration slices outside their window", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2024,
        base: 1_000_000,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "none",
        isVoid: false,
      },
    ],
    bonusProrations: [
      { amount: 10_000_000, firstYear: 2025, years: 5, source: "signing" },
    ],
  });
  assertEquals(computeCapHit(contract, 2024), 1_000_000);
});

Deno.test("computeCapHit: rounding residue lands on the final proration year", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2024,
        base: 0,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "none",
        isVoid: false,
      },
      {
        leagueYear: 2025,
        base: 0,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "none",
        isVoid: false,
      },
      {
        leagueYear: 2026,
        base: 0,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "none",
        isVoid: false,
      },
    ],
    bonusProrations: [
      { amount: 10_000_000, firstYear: 2024, years: 3, source: "signing" },
    ],
  });
  // floor(10M/3) = 3_333_333 for years 2024 and 2025
  // final year gets 10M - 2*3_333_333 = 3_333_334
  assertEquals(computeCapHit(contract, 2024), 3_333_333);
  assertEquals(computeCapHit(contract, 2025), 3_333_333);
  assertEquals(computeCapHit(contract, 2026), 3_333_334);
});

Deno.test("computeCapHit: unexercised option bonuses contribute nothing", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2024,
        base: 1_000_000,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "none",
        isVoid: false,
      },
    ],
    optionBonuses: [
      {
        amount: 50_000_000,
        exerciseYear: 2025,
        prorationYears: 5,
        exercisedAt: null,
      },
    ],
  });
  assertEquals(computeCapHit(contract, 2024), 1_000_000);
});

// ---------- computeDeadCap ----------

Deno.test("computeDeadCap: accelerates remaining proration slices", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2024,
        base: 5_000_000,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "none",
        isVoid: false,
      },
      {
        leagueYear: 2025,
        base: 5_000_000,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "none",
        isVoid: false,
      },
    ],
    bonusProrations: [
      { amount: 10_000_000, firstYear: 2024, years: 5, source: "signing" },
    ],
  });
  // Cut in 2025: remaining years = 2025,2026,2027,2028 = 4 years
  // perYear = floor(10M/5) = 2_000_000
  // accelerated = 2_000_000 * 4 = 8_000_000
  // No guaranteed base/roster bonus => dead cap = 8_000_000
  assertEquals(computeDeadCap(contract, 2025), 8_000_000);
});

Deno.test("computeDeadCap: includes fully guaranteed base and roster bonus from cutYear onward", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2024,
        base: 5_000_000,
        rosterBonus: 1_000_000,
        workoutBonus: 500_000,
        perGameRosterBonus: 200_000,
        guaranteeType: "full",
        isVoid: false,
      },
      {
        leagueYear: 2025,
        base: 3_000_000,
        rosterBonus: 500_000,
        workoutBonus: 0,
        perGameRosterBonus: 100_000,
        guaranteeType: "full",
        isVoid: false,
      },
      {
        leagueYear: 2026,
        base: 2_000_000,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "none",
        isVoid: false,
      },
    ],
  });
  // Cut in 2025: guaranteed base+roster from 2025 onward
  // 2025: 3M + 500K = 3_500_000 (full guarantee)
  // 2026: none guarantee, excluded
  assertEquals(computeDeadCap(contract, 2025), 3_500_000);
});

Deno.test("computeDeadCap: PGRB is excluded (not guaranteed)", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2024,
        base: 1_000_000,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 2_000_000,
        guaranteeType: "full",
        isVoid: false,
      },
    ],
  });
  // PGRB excluded; only base is guaranteed
  assertEquals(computeDeadCap(contract, 2024), 1_000_000);
});

Deno.test("computeDeadCap: combines accelerated proration with guaranteed salary", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2024,
        base: 5_000_000,
        rosterBonus: 1_000_000,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "full",
        isVoid: false,
      },
      {
        leagueYear: 2025,
        base: 10_000_000,
        rosterBonus: 2_000_000,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "full",
        isVoid: false,
      },
    ],
    bonusProrations: [
      { amount: 20_000_000, firstYear: 2024, years: 5, source: "signing" },
    ],
  });
  // Cut in 2025:
  // Accelerated proration: remaining = 4 years, perYear = floor(20M/5) = 4M => 16M
  // Guaranteed from 2025: base 10M + roster 2M = 12M
  // Total: 16M + 12M = 28M
  assertEquals(computeDeadCap(contract, 2025), 28_000_000);
});

Deno.test("computeDeadCap: rounding residue lands on final proration year in acceleration", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2024,
        base: 0,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "none",
        isVoid: false,
      },
    ],
    bonusProrations: [
      { amount: 10_000_000, firstYear: 2024, years: 3, source: "signing" },
    ],
  });
  // Cut in 2024: accelerate all 3 years
  // With residue handling: total must equal 10_000_000
  assertEquals(computeDeadCap(contract, 2024), 10_000_000);
});

Deno.test("computeDeadCap: unexercised option bonuses contribute nothing", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2024,
        base: 1_000_000,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "full",
        isVoid: false,
      },
    ],
    optionBonuses: [
      {
        amount: 50_000_000,
        exerciseYear: 2025,
        prorationYears: 5,
        exercisedAt: null,
      },
    ],
  });
  assertEquals(computeDeadCap(contract, 2024), 1_000_000);
});

Deno.test("computeDeadCap: injury-only guarantees are excluded", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2024,
        base: 5_000_000,
        rosterBonus: 1_000_000,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "injury",
        isVoid: false,
      },
    ],
  });
  assertEquals(computeDeadCap(contract, 2024), 0);
});

// ---------- computeHeadlineValue ----------

Deno.test("computeHeadlineValue: sums all yearly dollars", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2024,
        base: 5_000_000,
        rosterBonus: 1_000_000,
        workoutBonus: 500_000,
        perGameRosterBonus: 850_000,
        guaranteeType: "full",
        isVoid: false,
      },
      {
        leagueYear: 2025,
        base: 6_000_000,
        rosterBonus: 1_000_000,
        workoutBonus: 500_000,
        perGameRosterBonus: 850_000,
        guaranteeType: "none",
        isVoid: false,
      },
    ],
  });
  // (5M+1M+500K+850K) + (6M+1M+500K+850K) = 7_350_000 + 8_350_000 = 15_700_000
  assertEquals(computeHeadlineValue(contract), 15_700_000);
});

Deno.test("computeHeadlineValue: includes materialized bonus proration face amounts", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2024,
        base: 1_000_000,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "none",
        isVoid: false,
      },
    ],
    bonusProrations: [
      { amount: 20_000_000, firstYear: 2024, years: 5, source: "signing" },
      { amount: 5_000_000, firstYear: 2025, years: 3, source: "restructure" },
    ],
  });
  // yearTotals: 1M
  // materialized: 20M + 5M = 25M
  // total: 26M
  assertEquals(computeHeadlineValue(contract), 26_000_000);
});

Deno.test("computeHeadlineValue: includes unexercised option bonus face amounts", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2024,
        base: 1_000_000,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "none",
        isVoid: false,
      },
    ],
    optionBonuses: [
      {
        amount: 50_000_000,
        exerciseYear: 2025,
        prorationYears: 5,
        exercisedAt: null,
      },
      {
        amount: 30_000_000,
        exerciseYear: 2026,
        prorationYears: 4,
        exercisedAt: null,
      },
    ],
  });
  // yearTotals: 1M
  // unexercised options: 50M + 30M = 80M
  // total: 81M
  assertEquals(computeHeadlineValue(contract), 81_000_000);
});

Deno.test("computeHeadlineValue: void years contribute their dollars to headline", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2024,
        base: 5_000_000,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "full",
        isVoid: false,
      },
      {
        leagueYear: 2025,
        base: 0,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "none",
        isVoid: true,
      },
    ],
  });
  assertEquals(computeHeadlineValue(contract), 5_000_000);
});

// ---------- Taysom Hill case study ----------

Deno.test("Taysom Hill: computeCapHit 2021 ≈ $10.075M", () => {
  const contract = makeTaysomHillContract();
  assertEquals(computeCapHit(contract, 2021), 10_075_000);
});

Deno.test("Taysom Hill: computeCapHit on void years returns 0 (no proration)", () => {
  const contract = makeTaysomHillContract();
  assertEquals(computeCapHit(contract, 2022), 0);
  assertEquals(computeCapHit(contract, 2023), 0);
  assertEquals(computeCapHit(contract, 2024), 0);
});

Deno.test("Taysom Hill: computeHeadlineValue ≈ $105.075M (real + options)", () => {
  const contract = makeTaysomHillContract();
  // Year totals: 2021 = 1.075M + 7.5M + 0 + 1.5M = 10.075M
  // Void years all zero
  // No materialized prorations (no signing bonus)
  // Unexercised option: $95M
  // Total: 10.075M + 95M = 105.075M
  assertEquals(computeHeadlineValue(contract), 105_075_000);
});

Deno.test("Taysom Hill: computeDeadCap 2022 = 0 (no proration, no remaining guarantees)", () => {
  const contract = makeTaysomHillContract();
  // Cut after 2021: no signing bonus proration, no guaranteed years remaining
  assertEquals(computeDeadCap(contract, 2022), 0);
});

function makeTaysomHillContract(): CapContractInput {
  return {
    years: [
      {
        leagueYear: 2021,
        base: 1_075_000,
        rosterBonus: 7_500_000,
        workoutBonus: 0,
        perGameRosterBonus: 1_500_000,
        guaranteeType: "full",
        isVoid: false,
      },
      {
        leagueYear: 2022,
        base: 0,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "none",
        isVoid: true,
      },
      {
        leagueYear: 2023,
        base: 0,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "none",
        isVoid: true,
      },
      {
        leagueYear: 2024,
        base: 0,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "none",
        isVoid: true,
      },
    ],
    bonusProrations: [],
    optionBonuses: [
      {
        amount: 95_000_000,
        exerciseYear: 2022,
        prorationYears: 5,
        exercisedAt: null,
      },
    ],
  };
}

// ---------- restructureContract ----------

function makeYear(
  leagueYear: number,
  base: number,
  overrides: Partial<CapContractInput["years"][number]> = {},
): CapContractInput["years"][number] {
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

Deno.test("restructureContract: reduces base in target year by amount", () => {
  const contract = makeContract({
    years: [
      makeYear(2024, 15_000_000),
      makeYear(2025, 15_000_000),
      makeYear(2026, 15_000_000),
    ],
    bonusProrations: [
      { amount: 10_000_000, firstYear: 2024, years: 3, source: "signing" },
    ],
  });

  const result = restructureContract(contract, 2025, 10_000_000);
  const year2025 = result.years.find((y) => y.leagueYear === 2025)!;
  assertEquals(year2025.base, 5_000_000);
});

Deno.test("restructureContract: adds a restructure proration row", () => {
  const contract = makeContract({
    years: [
      makeYear(2024, 15_000_000),
      makeYear(2025, 15_000_000),
      makeYear(2026, 15_000_000),
    ],
    bonusProrations: [
      { amount: 10_000_000, firstYear: 2024, years: 3, source: "signing" },
    ],
  });

  const result = restructureContract(contract, 2025, 10_000_000);
  const restructureSlice = result.bonusProrations.find(
    (p) => p.source === "restructure",
  );
  assertEquals(restructureSlice !== undefined, true);
  assertEquals(restructureSlice!.amount, 10_000_000);
  assertEquals(restructureSlice!.firstYear, 2025);
  assertEquals(restructureSlice!.years, 2);
});

Deno.test("restructureContract: proration years capped at 5", () => {
  const years = [];
  for (let y = 2024; y <= 2031; y++) {
    years.push(makeYear(y, 10_000_000));
  }
  const contract = makeContract({ years });

  const result = restructureContract(contract, 2024, 5_000_000);
  const restructureSlice = result.bonusProrations.find(
    (p) => p.source === "restructure",
  );
  assertEquals(restructureSlice!.years, 5);
});

Deno.test("restructureContract: does not mutate the original contract", () => {
  const contract = makeContract({
    years: [makeYear(2024, 15_000_000), makeYear(2025, 15_000_000)],
    bonusProrations: [
      { amount: 10_000_000, firstYear: 2024, years: 2, source: "signing" },
    ],
  });

  restructureContract(contract, 2025, 5_000_000);
  assertEquals(contract.years[1].base, 15_000_000);
  assertEquals(contract.bonusProrations.length, 1);
});

Deno.test("restructureContract: does not mutate the original signing bonus proration", () => {
  const contract = makeContract({
    years: [makeYear(2024, 15_000_000), makeYear(2025, 15_000_000)],
    bonusProrations: [
      { amount: 10_000_000, firstYear: 2024, years: 2, source: "signing" },
    ],
  });

  const result = restructureContract(contract, 2025, 5_000_000);
  const signingSlice = result.bonusProrations.find(
    (p) => p.source === "signing",
  );
  assertEquals(signingSlice!.amount, 10_000_000);
});

Deno.test("restructureContract: cap-hit total is invariant before and after", () => {
  const contract = makeContract({
    years: [
      makeYear(2024, 15_000_000),
      makeYear(2025, 15_000_000),
      makeYear(2026, 12_000_000),
      makeYear(2027, 10_000_000),
    ],
    bonusProrations: [
      { amount: 20_000_000, firstYear: 2024, years: 4, source: "signing" },
    ],
  });

  const allYears = [2024, 2025, 2026, 2027];
  const totalBefore = allYears.reduce(
    (sum, y) => sum + computeCapHit(contract, y),
    0,
  );

  const result = restructureContract(contract, 2025, 10_000_000);
  const totalAfter = allYears.reduce(
    (sum, y) => sum + computeCapHit(result, y),
    0,
  );

  assertEquals(totalBefore, totalAfter);
});

Deno.test("restructureContract: cap hit shifts from restructure year to proration window", () => {
  const contract = makeContract({
    years: [
      makeYear(2024, 15_000_000),
      makeYear(2025, 15_000_000),
      makeYear(2026, 15_000_000),
      makeYear(2027, 15_000_000),
    ],
  });

  const result = restructureContract(contract, 2025, 12_000_000);

  // Year 2025 base drops by 12M: 15M -> 3M
  // New proration: 12M over min(5, 3 remaining from 2025) = 3 years
  // 12M / 3 = 4M per year in 2025, 2026, 2027
  assertEquals(computeCapHit(result, 2024), 15_000_000);
  assertEquals(computeCapHit(result, 2025), 3_000_000 + 4_000_000);
  assertEquals(computeCapHit(result, 2026), 15_000_000 + 4_000_000);
  assertEquals(computeCapHit(result, 2027), 15_000_000 + 4_000_000);
});

Deno.test("restructureContract: dead cap reflects restructure proration", () => {
  const contract = makeContract({
    years: [
      makeYear(2024, 10_000_000),
      makeYear(2025, 10_000_000),
      makeYear(2026, 10_000_000),
    ],
    bonusProrations: [
      { amount: 9_000_000, firstYear: 2024, years: 3, source: "signing" },
    ],
  });

  const result = restructureContract(contract, 2025, 6_000_000);

  // Cut in 2026:
  // Signing: 9M/3 = 3M/yr, remaining from 2026 = 1 year, accel = 3M
  // Restructure: 6M/2 = 3M/yr, remaining from 2026 = 1 year, accel = 3M
  // Total dead cap = 6M
  assertEquals(computeDeadCap(result, 2026), 6_000_000);
});

Deno.test("restructureContract: preserves optionBonuses unchanged", () => {
  const contract = makeContract({
    years: [makeYear(2024, 10_000_000), makeYear(2025, 10_000_000)],
    optionBonuses: [
      {
        amount: 50_000_000,
        exerciseYear: 2025,
        prorationYears: 5,
        exercisedAt: null,
      },
    ],
  });

  const result = restructureContract(contract, 2025, 5_000_000);
  assertEquals(result.optionBonuses.length, 1);
  assertEquals(result.optionBonuses[0].amount, 50_000_000);
});
