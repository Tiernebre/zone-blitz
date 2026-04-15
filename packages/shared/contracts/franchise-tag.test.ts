import { assertEquals, assertThrows } from "@std/assert";
import {
  computeTagSalary,
  createTagContract,
  type TagContractInput,
} from "./franchise-tag.ts";
import { computeCapHit, computeDeadCap } from "./cap-engine.ts";

// ---------- computeTagSalary ----------

Deno.test("computeTagSalary: averages top 5 salaries when more than 5 provided", () => {
  const salaries = [
    10_000_000,
    8_000_000,
    6_000_000,
    4_000_000,
    2_000_000,
    1_000_000,
    500_000,
  ];
  // top 5: 10M + 8M + 6M + 4M + 2M = 30M, average = 6M
  assertEquals(computeTagSalary(salaries), 6_000_000);
});

Deno.test("computeTagSalary: averages all salaries when exactly 5 provided", () => {
  const salaries = [
    10_000_000,
    8_000_000,
    6_000_000,
    4_000_000,
    2_000_000,
  ];
  assertEquals(computeTagSalary(salaries), 6_000_000);
});

Deno.test("computeTagSalary: averages all salaries when fewer than 5 provided", () => {
  const salaries = [10_000_000, 6_000_000, 2_000_000];
  // average of 3: (10M + 6M + 2M) / 3 = 6M
  assertEquals(computeTagSalary(salaries), 6_000_000);
});

Deno.test("computeTagSalary: handles single salary", () => {
  assertEquals(computeTagSalary([15_000_000]), 15_000_000);
});

Deno.test("computeTagSalary: rounds down to integer", () => {
  // 10M + 7M + 3M = 20M, avg = 6_666_666.67, floor = 6_666_666
  const salaries = [10_000_000, 7_000_000, 3_000_000];
  assertEquals(computeTagSalary(salaries), 6_666_666);
});

Deno.test("computeTagSalary: sorts descending regardless of input order", () => {
  const salaries = [
    2_000_000,
    10_000_000,
    500_000,
    8_000_000,
    6_000_000,
    4_000_000,
    1_000_000,
  ];
  assertEquals(computeTagSalary(salaries), 6_000_000);
});

Deno.test("computeTagSalary: throws on empty array", () => {
  assertThrows(
    () => computeTagSalary([]),
    Error,
    "at least one salary",
  );
});

// ---------- createTagContract ----------

Deno.test("createTagContract: creates a one-year franchise tag contract", () => {
  const input: TagContractInput = {
    playerId: "player-1",
    teamId: "team-1",
    tagType: "franchise",
    baseSalary: 15_000_000,
    leagueYear: 2025,
  };

  const bundle = createTagContract(input);

  assertEquals(bundle.contract.playerId, "player-1");
  assertEquals(bundle.contract.teamId, "team-1");
  assertEquals(bundle.contract.tagType, "franchise");
  assertEquals(bundle.contract.totalYears, 1);
  assertEquals(bundle.contract.realYears, 1);
  assertEquals(bundle.contract.signingBonus, 0);
  assertEquals(bundle.contract.signedYear, 2025);
  assertEquals(bundle.contract.isRookieDeal, false);
  assertEquals(bundle.contract.rookieDraftPick, null);
});

Deno.test("createTagContract: creates a one-year transition tag contract", () => {
  const input: TagContractInput = {
    playerId: "player-2",
    teamId: "team-2",
    tagType: "transition",
    baseSalary: 12_000_000,
    leagueYear: 2025,
  };

  const bundle = createTagContract(input);

  assertEquals(bundle.contract.tagType, "transition");
  assertEquals(bundle.contract.totalYears, 1);
  assertEquals(bundle.contract.realYears, 1);
  assertEquals(bundle.contract.signingBonus, 0);
});

Deno.test("createTagContract: single contract year has base salary and full guarantee", () => {
  const input: TagContractInput = {
    playerId: "player-1",
    teamId: "team-1",
    tagType: "franchise",
    baseSalary: 15_000_000,
    leagueYear: 2025,
  };

  const bundle = createTagContract(input);

  assertEquals(bundle.years.length, 1);
  assertEquals(bundle.years[0].leagueYear, 2025);
  assertEquals(bundle.years[0].base, 15_000_000);
  assertEquals(bundle.years[0].rosterBonus, 0);
  assertEquals(bundle.years[0].workoutBonus, 0);
  assertEquals(bundle.years[0].perGameRosterBonus, 0);
  assertEquals(bundle.years[0].guaranteeType, "full");
  assertEquals(bundle.years[0].isVoid, false);
});

Deno.test("createTagContract: no bonus prorations", () => {
  const input: TagContractInput = {
    playerId: "player-1",
    teamId: "team-1",
    tagType: "franchise",
    baseSalary: 15_000_000,
    leagueYear: 2025,
  };

  const bundle = createTagContract(input);

  assertEquals(bundle.bonusProrations.length, 0);
});

// ---------- Cap uniformity: tag contracts need no special branching ----------

Deno.test("tag contract: computeCapHit equals base salary (no proration, no bonuses)", () => {
  const input: TagContractInput = {
    playerId: "player-1",
    teamId: "team-1",
    tagType: "franchise",
    baseSalary: 24_000_000,
    leagueYear: 2025,
  };

  const bundle = createTagContract(input);

  const capInput = {
    years: bundle.years,
    bonusProrations: bundle.bonusProrations,
    optionBonuses: [],
  };

  assertEquals(computeCapHit(capInput, 2025), 24_000_000);
  assertEquals(computeCapHit(capInput, 2026), 0);
});

Deno.test("tag contract: computeDeadCap equals base salary (fully guaranteed, no proration)", () => {
  const input: TagContractInput = {
    playerId: "player-1",
    teamId: "team-1",
    tagType: "franchise",
    baseSalary: 24_000_000,
    leagueYear: 2025,
  };

  const bundle = createTagContract(input);

  const capInput = {
    years: bundle.years,
    bonusProrations: bundle.bonusProrations,
    optionBonuses: [],
  };

  assertEquals(computeDeadCap(capInput, 2025), 24_000_000);
});

Deno.test("tag contract: dead cap is 0 after contract year expires", () => {
  const input: TagContractInput = {
    playerId: "player-1",
    teamId: "team-1",
    tagType: "transition",
    baseSalary: 18_000_000,
    leagueYear: 2025,
  };

  const bundle = createTagContract(input);

  const capInput = {
    years: bundle.years,
    bonusProrations: bundle.bonusProrations,
    optionBonuses: [],
  };

  assertEquals(computeDeadCap(capInput, 2026), 0);
});
