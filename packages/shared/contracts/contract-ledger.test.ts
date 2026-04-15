import { assertEquals } from "@std/assert";
import {
  buildContractYears,
  type ContractYearInput,
  type ContractYearRow,
} from "./contract-ledger.ts";

Deno.test("buildContractYears: distributes signing bonus proration evenly", () => {
  const input: ContractYearInput = {
    totalYears: 4,
    annualSalary: 20_000_000,
    signingBonus: 8_000_000,
    guaranteedMoney: 40_000_000,
    currentYear: 1,
  };
  const years = buildContractYears(input);
  assertEquals(years.length, 4);
  for (const year of years) {
    assertEquals(year.signingBonusProration, 2_000_000);
  }
});

Deno.test("buildContractYears: base salary = annualSalary - proration", () => {
  const input: ContractYearInput = {
    totalYears: 4,
    annualSalary: 20_000_000,
    signingBonus: 8_000_000,
    guaranteedMoney: 40_000_000,
    currentYear: 1,
  };
  const years = buildContractYears(input);
  for (const year of years) {
    assertEquals(year.baseSalary, 18_000_000);
  }
});

Deno.test("buildContractYears: cap hit equals annualSalary", () => {
  const input: ContractYearInput = {
    totalYears: 3,
    annualSalary: 15_000_000,
    signingBonus: 6_000_000,
    guaranteedMoney: 20_000_000,
    currentYear: 1,
  };
  const years = buildContractYears(input);
  for (const year of years) {
    assertEquals(year.capHit, 15_000_000);
  }
});

Deno.test("buildContractYears: dead cap decreases each year", () => {
  const input: ContractYearInput = {
    totalYears: 4,
    annualSalary: 20_000_000,
    signingBonus: 8_000_000,
    guaranteedMoney: 40_000_000,
    currentYear: 1,
  };
  const years = buildContractYears(input);
  assertEquals(years[0].deadCap, 8_000_000);
  assertEquals(years[1].deadCap, 6_000_000);
  assertEquals(years[2].deadCap, 4_000_000);
  assertEquals(years[3].deadCap, 2_000_000);
});

Deno.test("buildContractYears: cash paid in year 1 includes full signing bonus", () => {
  const input: ContractYearInput = {
    totalYears: 3,
    annualSalary: 10_000_000,
    signingBonus: 3_000_000,
    guaranteedMoney: 15_000_000,
    currentYear: 1,
  };
  const years = buildContractYears(input);
  assertEquals(years[0].cashPaid, 9_000_000 + 3_000_000);
  assertEquals(years[1].cashPaid, 9_000_000);
  assertEquals(years[2].cashPaid, 9_000_000);
});

Deno.test("buildContractYears: year numbers are sequential starting at 1", () => {
  const input: ContractYearInput = {
    totalYears: 3,
    annualSalary: 5_000_000,
    signingBonus: 0,
    guaranteedMoney: 2_000_000,
    currentYear: 1,
  };
  const years = buildContractYears(input);
  assertEquals(years.map((y) => y.yearNumber), [1, 2, 3]);
});

Deno.test("buildContractYears: no void years by default", () => {
  const input: ContractYearInput = {
    totalYears: 2,
    annualSalary: 5_000_000,
    signingBonus: 1_000_000,
    guaranteedMoney: 3_000_000,
    currentYear: 1,
  };
  const years = buildContractYears(input);
  for (const year of years) {
    assertEquals(year.isVoid, false);
  }
});

Deno.test("buildContractYears: void years have zero base salary and zero cash paid", () => {
  const input: ContractYearInput = {
    totalYears: 3,
    annualSalary: 10_000_000,
    signingBonus: 9_000_000,
    guaranteedMoney: 15_000_000,
    currentYear: 1,
    voidYears: 2,
  };
  const years = buildContractYears(input);
  assertEquals(years.length, 5);
  assertEquals(years[3].isVoid, true);
  assertEquals(years[3].baseSalary, 0);
  assertEquals(years[3].cashPaid, 0);
  assertEquals(years[3].rosterBonus, 0);
  assertEquals(years[3].workoutBonus, 0);
  assertEquals(years[4].isVoid, true);
  assertEquals(years[4].baseSalary, 0);
  assertEquals(years[4].cashPaid, 0);
});

Deno.test("buildContractYears: void years carry signing bonus proration", () => {
  const input: ContractYearInput = {
    totalYears: 2,
    annualSalary: 10_000_000,
    signingBonus: 10_000_000,
    guaranteedMoney: 15_000_000,
    currentYear: 1,
    voidYears: 3,
  };
  const years = buildContractYears(input);
  const prorationYears = 2 + 3;
  const proration = Math.floor(10_000_000 / prorationYears);
  for (const year of years) {
    assertEquals(year.signingBonusProration, proration);
  }
});

Deno.test("buildContractYears: void years have dead cap from remaining proration", () => {
  const input: ContractYearInput = {
    totalYears: 2,
    annualSalary: 10_000_000,
    signingBonus: 10_000_000,
    guaranteedMoney: 15_000_000,
    currentYear: 1,
    voidYears: 3,
  };
  const years = buildContractYears(input);
  const totalCapYears = 5;
  const proration = Math.floor(10_000_000 / totalCapYears);
  assertEquals(years[0].deadCap, proration * totalCapYears);
  assertEquals(years[4].deadCap, proration);
});

Deno.test("buildContractYears: zero signing bonus produces zero proration and dead cap", () => {
  const input: ContractYearInput = {
    totalYears: 2,
    annualSalary: 5_000_000,
    signingBonus: 0,
    guaranteedMoney: 3_000_000,
    currentYear: 1,
  };
  const years = buildContractYears(input);
  for (const year of years) {
    assertEquals(year.signingBonusProration, 0);
    assertEquals(year.deadCap, 0);
  }
});

Deno.test("buildContractYears: single-year contract", () => {
  const input: ContractYearInput = {
    totalYears: 1,
    annualSalary: 1_000_000,
    signingBonus: 200_000,
    guaranteedMoney: 500_000,
    currentYear: 1,
  };
  const years = buildContractYears(input);
  assertEquals(years.length, 1);
  assertEquals(years[0].yearNumber, 1);
  assertEquals(years[0].baseSalary, 800_000);
  assertEquals(years[0].signingBonusProration, 200_000);
  assertEquals(years[0].capHit, 1_000_000);
  assertEquals(years[0].deadCap, 200_000);
  assertEquals(years[0].cashPaid, 800_000 + 200_000);
  assertEquals(years[0].isVoid, false);
});

Deno.test("buildContractYears: roster and workout bonuses are zero by default", () => {
  const input: ContractYearInput = {
    totalYears: 2,
    annualSalary: 5_000_000,
    signingBonus: 0,
    guaranteedMoney: 3_000_000,
    currentYear: 1,
  };
  const years = buildContractYears(input);
  for (const year of years) {
    assertEquals(year.rosterBonus, 0);
    assertEquals(year.workoutBonus, 0);
  }
});
