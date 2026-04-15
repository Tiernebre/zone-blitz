import { assertEquals } from "@std/assert";
import { type CapHitContract, computeCapHit } from "./cap-hit.ts";

function makeContract(
  overrides: Partial<CapHitContract> = {},
): CapHitContract {
  return {
    years: [],
    bonusProrations: [],
    ...overrides,
  };
}

Deno.test("computeCapHit returns 0 for a year not in the contract", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2026,
        base: 5_000_000,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        isVoid: false,
      },
    ],
  });
  assertEquals(computeCapHit(contract, 2027), 0);
});

Deno.test("computeCapHit returns base salary for a year with no bonuses", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2026,
        base: 5_000_000,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        isVoid: false,
      },
    ],
  });
  assertEquals(computeCapHit(contract, 2026), 5_000_000);
});

Deno.test("computeCapHit includes roster, workout, and PGRB", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2026,
        base: 5_000_000,
        rosterBonus: 1_000_000,
        workoutBonus: 500_000,
        perGameRosterBonus: 750_000,
        isVoid: false,
      },
    ],
  });
  assertEquals(computeCapHit(contract, 2026), 7_250_000);
});

Deno.test("computeCapHit prorates signing bonus evenly across years", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2026,
        base: 3_000_000,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        isVoid: false,
      },
      {
        leagueYear: 2027,
        base: 3_000_000,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        isVoid: false,
      },
    ],
    bonusProrations: [
      { amount: 10_000_000, firstYear: 2026, years: 2, source: "signing" },
    ],
  });
  assertEquals(computeCapHit(contract, 2026), 3_000_000 + 5_000_000);
  assertEquals(computeCapHit(contract, 2027), 3_000_000 + 5_000_000);
});

Deno.test("computeCapHit places rounding residue on the final proration year", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2026,
        base: 1_000_000,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        isVoid: false,
      },
      {
        leagueYear: 2027,
        base: 1_000_000,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        isVoid: false,
      },
      {
        leagueYear: 2028,
        base: 1_000_000,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        isVoid: false,
      },
    ],
    bonusProrations: [
      { amount: 10_000_000, firstYear: 2026, years: 3, source: "signing" },
    ],
  });
  const perYear = Math.floor(10_000_000 / 3);
  const residue = 10_000_000 - perYear * 2;
  assertEquals(computeCapHit(contract, 2026), 1_000_000 + perYear);
  assertEquals(computeCapHit(contract, 2027), 1_000_000 + perYear);
  assertEquals(computeCapHit(contract, 2028), 1_000_000 + residue);
});

Deno.test("computeCapHit on a void year returns only prorated portion", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2026,
        base: 5_000_000,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        isVoid: false,
      },
      {
        leagueYear: 2027,
        base: 0,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        isVoid: true,
      },
    ],
    bonusProrations: [
      { amount: 4_000_000, firstYear: 2026, years: 2, source: "signing" },
    ],
  });
  assertEquals(computeCapHit(contract, 2027), 2_000_000);
});

Deno.test("computeCapHit sums multiple proration slices (signing + restructure)", () => {
  const contract = makeContract({
    years: [
      {
        leagueYear: 2027,
        base: 2_000_000,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        isVoid: false,
      },
    ],
    bonusProrations: [
      { amount: 6_000_000, firstYear: 2026, years: 3, source: "signing" },
      {
        amount: 3_000_000,
        firstYear: 2027,
        years: 2,
        source: "restructure",
      },
    ],
  });
  assertEquals(
    computeCapHit(contract, 2027),
    2_000_000 + Math.floor(6_000_000 / 3) + Math.floor(3_000_000 / 2),
  );
});

Deno.test("sum of cap hits equals total contract value for a simple deal", () => {
  const signingBonus = 8_000_000;
  const bases = [4_000_000, 5_000_000, 6_000_000, 7_000_000];
  const totalValue = bases.reduce((s, b) => s + b, 0) + signingBonus;
  const contract = makeContract({
    years: bases.map((base, i) => ({
      leagueYear: 2026 + i,
      base,
      rosterBonus: 0,
      workoutBonus: 0,
      perGameRosterBonus: 0,
      isVoid: false,
    })),
    bonusProrations: [
      { amount: signingBonus, firstYear: 2026, years: 4, source: "signing" },
    ],
  });
  const capHitSum = [2026, 2027, 2028, 2029].reduce(
    (sum, y) => sum + computeCapHit(contract, y),
    0,
  );
  assertEquals(capHitSum, totalValue);
});

Deno.test("sum of cap hits equals total contract value with void years", () => {
  const signingBonus = 10_000_000;
  const bases = [3_000_000, 4_000_000];
  const totalValue = bases.reduce((s, b) => s + b, 0) + signingBonus;
  const contract = makeContract({
    years: [
      ...bases.map((base, i) => ({
        leagueYear: 2026 + i,
        base,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        isVoid: false,
      })),
      {
        leagueYear: 2028,
        base: 0,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        isVoid: true,
      },
      {
        leagueYear: 2029,
        base: 0,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        isVoid: true,
      },
    ],
    bonusProrations: [
      { amount: signingBonus, firstYear: 2026, years: 4, source: "signing" },
    ],
  });
  const capHitSum = [2026, 2027, 2028, 2029].reduce(
    (sum, y) => sum + computeCapHit(contract, y),
    0,
  );
  assertEquals(capHitSum, totalValue);
});
