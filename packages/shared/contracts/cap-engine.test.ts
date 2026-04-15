import { assertEquals } from "@std/assert";
import {
  type CapContract,
  type CapContractYear,
  computeCapHit,
  computeDeadCap,
  restructureContract,
} from "./cap-engine.ts";

function makeYear(
  overrides: Partial<CapContractYear> & { leagueYear: number },
): CapContractYear {
  return {
    base: 0,
    rosterBonus: 0,
    workoutBonus: 0,
    perGameRosterBonus: 0,
    guaranteeType: "none",
    isVoid: false,
    ...overrides,
  };
}

function makeContract(overrides: Partial<CapContract> = {}): CapContract {
  return {
    signedYear: 2024,
    totalYears: 4,
    years: [],
    bonusProrations: [],
    ...overrides,
  };
}

// --- computeCapHit ---

Deno.test("computeCapHit: returns 0 for a year not in the contract", () => {
  const contract = makeContract({
    years: [makeYear({ leagueYear: 2024, base: 10_000_000 })],
  });
  assertEquals(computeCapHit(contract, 2030), 0);
});

Deno.test("computeCapHit: base salary counts fully in that year", () => {
  const contract = makeContract({
    years: [makeYear({ leagueYear: 2024, base: 10_000_000 })],
  });
  assertEquals(computeCapHit(contract, 2024), 10_000_000);
});

Deno.test("computeCapHit: sums base, roster, workout, and PGRB", () => {
  const contract = makeContract({
    years: [
      makeYear({
        leagueYear: 2024,
        base: 5_000_000,
        rosterBonus: 1_000_000,
        workoutBonus: 500_000,
        perGameRosterBonus: 750_000,
      }),
    ],
  });
  assertEquals(computeCapHit(contract, 2024), 7_250_000);
});

Deno.test("computeCapHit: includes signing bonus proration from bonusProrations", () => {
  const contract = makeContract({
    years: [makeYear({ leagueYear: 2024, base: 8_000_000 })],
    bonusProrations: [
      { amount: 20_000_000, firstYear: 2024, years: 4, source: "signing" },
    ],
  });
  // 8M base + 20M/4 = 8M + 5M = 13M
  assertEquals(computeCapHit(contract, 2024), 13_000_000);
});

Deno.test("computeCapHit: sums multiple proration slices (signing + restructure)", () => {
  const contract = makeContract({
    years: [makeYear({ leagueYear: 2025, base: 5_000_000 })],
    bonusProrations: [
      { amount: 20_000_000, firstYear: 2024, years: 4, source: "signing" },
      { amount: 6_000_000, firstYear: 2025, years: 3, source: "restructure" },
    ],
  });
  // 5M base + 20M/4 + 6M/3 = 5M + 5M + 2M = 12M
  assertEquals(computeCapHit(contract, 2025), 12_000_000);
});

Deno.test("computeCapHit: proration slice outside its window contributes nothing", () => {
  const contract = makeContract({
    years: [makeYear({ leagueYear: 2028, base: 5_000_000 })],
    bonusProrations: [
      { amount: 20_000_000, firstYear: 2024, years: 4, source: "signing" },
    ],
  });
  // Proration covers 2024-2027, year 2028 is outside
  assertEquals(computeCapHit(contract, 2028), 5_000_000);
});

Deno.test("computeCapHit: void year carries only proration", () => {
  const contract = makeContract({
    years: [makeYear({ leagueYear: 2028, base: 0, isVoid: true })],
    bonusProrations: [
      { amount: 25_000_000, firstYear: 2024, years: 5, source: "signing" },
    ],
  });
  assertEquals(computeCapHit(contract, 2028), 5_000_000);
});

// --- computeDeadCap ---

Deno.test("computeDeadCap: accelerates remaining proration slices", () => {
  const contract = makeContract({
    years: [
      makeYear({ leagueYear: 2024, base: 10_000_000 }),
      makeYear({ leagueYear: 2025, base: 10_000_000 }),
      makeYear({ leagueYear: 2026, base: 10_000_000 }),
      makeYear({ leagueYear: 2027, base: 10_000_000 }),
    ],
    bonusProrations: [
      { amount: 20_000_000, firstYear: 2024, years: 4, source: "signing" },
    ],
  });
  // Cut in 2026: remaining years = 2026, 2027 = 2 years of proration
  // perYear = 20M/4 = 5M, accelerated = 5M * 2 = 10M
  assertEquals(computeDeadCap(contract, 2026), 10_000_000);
});

Deno.test("computeDeadCap: includes fully guaranteed base and roster bonus from remaining years", () => {
  const contract = makeContract({
    years: [
      makeYear({
        leagueYear: 2024,
        base: 10_000_000,
        rosterBonus: 2_000_000,
        guaranteeType: "full",
      }),
      makeYear({
        leagueYear: 2025,
        base: 8_000_000,
        rosterBonus: 1_000_000,
        guaranteeType: "full",
      }),
      makeYear({
        leagueYear: 2026,
        base: 6_000_000,
        guaranteeType: "none",
      }),
    ],
  });
  // Cut in 2025: guaranteed remaining = 2025 (8M + 1M) = 9M
  // No proration slices, so dead cap = 9M
  assertEquals(computeDeadCap(contract, 2025), 9_000_000);
});

Deno.test("computeDeadCap: sums accelerated proration and guaranteed base", () => {
  const contract = makeContract({
    years: [
      makeYear({
        leagueYear: 2024,
        base: 10_000_000,
        guaranteeType: "full",
      }),
      makeYear({
        leagueYear: 2025,
        base: 10_000_000,
        guaranteeType: "full",
      }),
      makeYear({ leagueYear: 2026, base: 10_000_000, guaranteeType: "none" }),
      makeYear({ leagueYear: 2027, base: 10_000_000, guaranteeType: "none" }),
    ],
    bonusProrations: [
      { amount: 20_000_000, firstYear: 2024, years: 4, source: "signing" },
    ],
  });
  // Cut in 2026:
  // Accelerated proration: 5M/yr * 2 remaining = 10M
  // Guaranteed base remaining in 2026+: none (both guaranteed years are before 2026)
  assertEquals(computeDeadCap(contract, 2026), 10_000_000);
});

Deno.test("computeDeadCap: multiple proration slices are summed", () => {
  const contract = makeContract({
    years: [
      makeYear({ leagueYear: 2024, base: 10_000_000 }),
      makeYear({ leagueYear: 2025, base: 10_000_000 }),
      makeYear({ leagueYear: 2026, base: 10_000_000 }),
    ],
    bonusProrations: [
      { amount: 15_000_000, firstYear: 2024, years: 3, source: "signing" },
      { amount: 6_000_000, firstYear: 2025, years: 2, source: "restructure" },
    ],
  });
  // Cut in 2025:
  // Signing: 15M/3 = 5M/yr, remaining = max(0, 2024+3-2025) = 2, accel = 5M*2 = 10M
  // Restructure: 6M/2 = 3M/yr, remaining = max(0, 2025+2-2025) = 2, accel = 3M*2 = 6M
  // Total = 16M
  assertEquals(computeDeadCap(contract, 2025), 16_000_000);
});

Deno.test("computeDeadCap: PGRB is not guaranteed and does not contribute", () => {
  const contract = makeContract({
    years: [
      makeYear({
        leagueYear: 2024,
        base: 5_000_000,
        perGameRosterBonus: 3_000_000,
        guaranteeType: "full",
      }),
    ],
  });
  // Cut in 2024: guaranteed base = 5M, PGRB is not guaranteed
  assertEquals(computeDeadCap(contract, 2024), 5_000_000);
});

// --- restructureContract ---

Deno.test("restructureContract: reduces base in target year by amount", () => {
  const contract = makeContract({
    years: [
      makeYear({ leagueYear: 2024, base: 15_000_000 }),
      makeYear({ leagueYear: 2025, base: 15_000_000 }),
      makeYear({ leagueYear: 2026, base: 15_000_000 }),
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
      makeYear({ leagueYear: 2024, base: 15_000_000 }),
      makeYear({ leagueYear: 2025, base: 15_000_000 }),
      makeYear({ leagueYear: 2026, base: 15_000_000 }),
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
  // remaining years from 2025: 2025, 2026 = 2 years, min(5, 2) = 2
  assertEquals(restructureSlice!.years, 2);
});

Deno.test("restructureContract: proration years capped at 5", () => {
  const years = [];
  for (let y = 2024; y <= 2031; y++) {
    years.push(makeYear({ leagueYear: y, base: 10_000_000 }));
  }
  const contract = makeContract({ totalYears: 8, years });

  const result = restructureContract(contract, 2024, 5_000_000);
  const restructureSlice = result.bonusProrations.find(
    (p) => p.source === "restructure",
  );
  assertEquals(restructureSlice!.years, 5);
});

Deno.test("restructureContract: does not mutate the original signingBonus proration", () => {
  const contract = makeContract({
    years: [
      makeYear({ leagueYear: 2024, base: 15_000_000 }),
      makeYear({ leagueYear: 2025, base: 15_000_000 }),
    ],
    bonusProrations: [
      { amount: 10_000_000, firstYear: 2024, years: 2, source: "signing" },
    ],
  });

  const result = restructureContract(contract, 2025, 5_000_000);
  const signingSlice = result.bonusProrations.find(
    (p) => p.source === "signing",
  );
  assertEquals(signingSlice!.amount, 10_000_000);
  // Original object not mutated
  assertEquals(contract.bonusProrations[0].amount, 10_000_000);
});

Deno.test("restructureContract: does not mutate the original contract", () => {
  const contract = makeContract({
    years: [
      makeYear({ leagueYear: 2024, base: 15_000_000 }),
      makeYear({ leagueYear: 2025, base: 15_000_000 }),
    ],
    bonusProrations: [],
  });

  restructureContract(contract, 2025, 5_000_000);
  assertEquals(contract.years[1].base, 15_000_000);
});

Deno.test("restructureContract: cap-hit total is invariant before and after", () => {
  const contract = makeContract({
    totalYears: 4,
    years: [
      makeYear({ leagueYear: 2024, base: 15_000_000 }),
      makeYear({ leagueYear: 2025, base: 15_000_000 }),
      makeYear({ leagueYear: 2026, base: 12_000_000 }),
      makeYear({ leagueYear: 2027, base: 10_000_000 }),
    ],
    bonusProrations: [
      { amount: 20_000_000, firstYear: 2024, years: 4, source: "signing" },
    ],
  });

  const totalBefore = [2024, 2025, 2026, 2027].reduce(
    (sum, y) => sum + computeCapHit(contract, y),
    0,
  );

  const result = restructureContract(contract, 2025, 10_000_000);

  const totalAfter = [2024, 2025, 2026, 2027].reduce(
    (sum, y) => sum + computeCapHit(result, y),
    0,
  );

  assertEquals(totalBefore, totalAfter);
});

Deno.test("restructureContract: cap hit shifts from restructure year to proration window", () => {
  const contract = makeContract({
    totalYears: 4,
    years: [
      makeYear({ leagueYear: 2024, base: 15_000_000 }),
      makeYear({ leagueYear: 2025, base: 15_000_000 }),
      makeYear({ leagueYear: 2026, base: 15_000_000 }),
      makeYear({ leagueYear: 2027, base: 15_000_000 }),
    ],
    bonusProrations: [],
  });

  const result = restructureContract(contract, 2025, 12_000_000);

  // Year 2025 base drops by 12M: 15M -> 3M
  // New proration: 12M over min(5, 3 remaining years from 2025) = 3 years
  // 12M / 3 = 4M per year in 2025, 2026, 2027
  assertEquals(computeCapHit(result, 2024), 15_000_000); // unaffected
  assertEquals(computeCapHit(result, 2025), 3_000_000 + 4_000_000); // 7M
  assertEquals(computeCapHit(result, 2026), 15_000_000 + 4_000_000); // 19M
  assertEquals(computeCapHit(result, 2027), 15_000_000 + 4_000_000); // 19M
});

Deno.test("restructureContract: dead cap reflects restructure proration", () => {
  const contract = makeContract({
    totalYears: 3,
    years: [
      makeYear({ leagueYear: 2024, base: 10_000_000 }),
      makeYear({ leagueYear: 2025, base: 10_000_000 }),
      makeYear({ leagueYear: 2026, base: 10_000_000 }),
    ],
    bonusProrations: [
      { amount: 9_000_000, firstYear: 2024, years: 3, source: "signing" },
    ],
  });

  const result = restructureContract(contract, 2025, 6_000_000);

  // Cut in 2026:
  // Signing: 9M/3 = 3M/yr, remaining from 2026 = 1, accel = 3M
  // Restructure: 6M/2 = 3M/yr, remaining from 2026 = 1, accel = 3M
  // No guaranteed base
  // Total dead cap = 6M
  assertEquals(computeDeadCap(result, 2026), 6_000_000);
});
