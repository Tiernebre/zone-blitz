import { assertEquals, assertNotEquals } from "@std/assert";
import type { CoachRole } from "@zone-blitz/shared";
import {
  createCoachesGenerator,
  type NameGenerator,
} from "./coaches-generator.ts";

const TEAM_IDS = ["team-1", "team-2", "team-3"];
const INPUT = {
  leagueId: "league-1",
  teamIds: TEAM_IDS,
};

const COACHES_PER_TEAM = 13;

const EXPECTED_ROLES: CoachRole[] = [
  "HC",
  "OC",
  "DC",
  "STC",
  "QB",
  "RB",
  "WR",
  "TE",
  "OL",
  "DL",
  "LB",
  "DB",
  "ST_ASSISTANT",
];

// mulberry32 — small, deterministic RNG for reproducible distribution tests.
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fixedNameGenerator(): NameGenerator {
  let i = 0;
  return {
    next() {
      i++;
      return { firstName: `First${i}`, lastName: `Last${i}` };
    },
  };
}

function makeGenerator(seed = 12345) {
  return createCoachesGenerator({
    random: seededRandom(seed),
    nameGenerator: fixedNameGenerator(),
  });
}

Deno.test("generates a full staff per team", () => {
  const result = makeGenerator().generate(INPUT);

  assertEquals(result.length, TEAM_IDS.length * COACHES_PER_TEAM);
  for (const teamId of TEAM_IDS) {
    const teamCoaches = result.filter((c) => c.teamId === teamId);
    assertEquals(teamCoaches.length, COACHES_PER_TEAM);
    const roles = new Set(teamCoaches.map((c) => c.role));
    for (const role of EXPECTED_ROLES) {
      assertEquals(roles.has(role), true, `team ${teamId} missing ${role}`);
    }
  }
});

Deno.test("each team has exactly one head coach", () => {
  const result = makeGenerator().generate(INPUT);
  for (const teamId of TEAM_IDS) {
    const hcs = result.filter((c) => c.teamId === teamId && c.role === "HC");
    assertEquals(hcs.length, 1);
  }
});

Deno.test("head coach has no reportsTo and non-null play caller", () => {
  const result = makeGenerator().generate(INPUT);
  const hcs = result.filter((c) => c.role === "HC");
  for (const hc of hcs) {
    assertEquals(hc.reportsToId, null);
    assertNotEquals(hc.playCaller, null);
  }
});

Deno.test("coordinators report to their head coach", () => {
  const result = makeGenerator().generate(INPUT);
  for (const teamId of TEAM_IDS) {
    const teamCoaches = result.filter((c) => c.teamId === teamId);
    const hc = teamCoaches.find((c) => c.role === "HC");
    const coordinators = teamCoaches.filter((c) =>
      c.role === "OC" || c.role === "DC" || c.role === "STC"
    );
    assertEquals(coordinators.length, 3);
    for (const coord of coordinators) {
      assertEquals(coord.reportsToId, hc?.id);
      assertEquals(coord.playCaller, null);
    }
  }
});

Deno.test("offensive position coaches report to OC", () => {
  const result = makeGenerator().generate(INPUT);
  const offensiveRoles: CoachRole[] = ["QB", "RB", "WR", "TE", "OL"];
  for (const teamId of TEAM_IDS) {
    const teamCoaches = result.filter((c) => c.teamId === teamId);
    const oc = teamCoaches.find((c) => c.role === "OC");
    for (const role of offensiveRoles) {
      const coach = teamCoaches.find((c) => c.role === role);
      assertEquals(coach?.reportsToId, oc?.id);
    }
  }
});

Deno.test("defensive position coaches report to DC", () => {
  const result = makeGenerator().generate(INPUT);
  const defensiveRoles: CoachRole[] = ["DL", "LB", "DB"];
  for (const teamId of TEAM_IDS) {
    const teamCoaches = result.filter((c) => c.teamId === teamId);
    const dc = teamCoaches.find((c) => c.role === "DC");
    for (const role of defensiveRoles) {
      const coach = teamCoaches.find((c) => c.role === role);
      assertEquals(coach?.reportsToId, dc?.id);
    }
  }
});

Deno.test("special teams assistant reports to STC", () => {
  const result = makeGenerator().generate(INPUT);
  for (const teamId of TEAM_IDS) {
    const teamCoaches = result.filter((c) => c.teamId === teamId);
    const stc = teamCoaches.find((c) => c.role === "STC");
    const sta = teamCoaches.find((c) => c.role === "ST_ASSISTANT");
    assertEquals(sta?.reportsToId, stc?.id);
  }
});

Deno.test("all coaches have the correct leagueId, non-empty names, plausible age", () => {
  const result = makeGenerator().generate(INPUT);
  for (const coach of result) {
    assertEquals(coach.leagueId, INPUT.leagueId);
    assertEquals(coach.firstName.length > 0, true);
    assertEquals(coach.lastName.length > 0, true);
    assertEquals(coach.age >= 30 && coach.age <= 75, true);
    assertEquals(coach.contractYears >= 1, true);
    assertEquals(coach.isVacancy, false);
  }
});

Deno.test("coaches have unique ids", () => {
  const result = makeGenerator().generate(INPUT);
  const ids = new Set(result.map((c) => c.id));
  assertEquals(ids.size, result.length);
});

Deno.test("coaches get a college when a pool is provided", () => {
  const collegeIds = ["college-a", "college-b"];
  const result = makeGenerator().generate({ ...INPUT, collegeIds });
  for (const coach of result) {
    assertEquals(collegeIds.includes(coach.collegeId ?? ""), true);
  }
});

Deno.test("coaches have null college when no pool is provided", () => {
  const result = makeGenerator().generate(INPUT);
  for (const coach of result) {
    assertEquals(coach.collegeId, null);
  }
});

Deno.test("generates no coaches when no teams provided", () => {
  const result = makeGenerator().generate({ leagueId: "l1", teamIds: [] });
  assertEquals(result.length, 0);
});

Deno.test("every OC carries a populated offensive tendency vector only", () => {
  const result = makeGenerator().generate(INPUT);
  const ocs = result.filter((c) => c.role === "OC");
  assertEquals(ocs.length, TEAM_IDS.length);
  for (const oc of ocs) {
    assertNotEquals(oc.tendencies, undefined);
    assertNotEquals(oc.tendencies?.offense, undefined);
    assertEquals(oc.tendencies?.defense, undefined);
    const values = Object.values(oc.tendencies!.offense!);
    assertEquals(values.length, 9);
    for (const v of values) {
      assertEquals(v >= 0 && v <= 100, true);
      assertEquals(Number.isInteger(v), true);
    }
  }
});

Deno.test("every DC carries a populated defensive tendency vector only", () => {
  const result = makeGenerator().generate(INPUT);
  const dcs = result.filter((c) => c.role === "DC");
  assertEquals(dcs.length, TEAM_IDS.length);
  for (const dc of dcs) {
    assertNotEquals(dc.tendencies, undefined);
    assertNotEquals(dc.tendencies?.defense, undefined);
    assertEquals(dc.tendencies?.offense, undefined);
    const values = Object.values(dc.tendencies!.defense!);
    assertEquals(values.length, 8);
    for (const v of values) {
      assertEquals(v >= 0 && v <= 100, true);
      assertEquals(Number.isInteger(v), true);
    }
  }
});

Deno.test("non-coordinator coaches have no tendencies (v1 scope: OC + DC only)", () => {
  const result = makeGenerator().generate(INPUT);
  const nonCoordinators = result.filter(
    (c) => c.role !== "OC" && c.role !== "DC",
  );
  assertEquals(nonCoordinators.length > 0, true);
  for (const coach of nonCoordinators) {
    assertEquals(coach.tendencies, undefined);
  }
});

// ---- Graduated-behaviour assertions ----

Deno.test("head coach ages span the HC tier band (~48-60)", () => {
  const result = makeGenerator().generate(INPUT);
  const hcs = result.filter((c) => c.role === "HC");
  for (const hc of hcs) {
    assertEquals(hc.age >= 48 && hc.age <= 60, true);
  }
});

Deno.test("coordinator ages span the coordinator tier band (~40-55)", () => {
  const result = makeGenerator().generate(INPUT);
  const coords = result.filter(
    (c) => c.role === "OC" || c.role === "DC" || c.role === "STC",
  );
  for (const coord of coords) {
    assertEquals(coord.age >= 40 && coord.age <= 55, true);
  }
});

Deno.test("position coach ages span the position tier band (~32-50)", () => {
  const result = makeGenerator().generate(INPUT);
  const positionRoles = new Set<CoachRole>([
    "QB",
    "RB",
    "WR",
    "TE",
    "OL",
    "DL",
    "LB",
    "DB",
    "ST_ASSISTANT",
  ]);
  const positions = result.filter((c) => positionRoles.has(c.role));
  for (const coach of positions) {
    assertEquals(coach.age >= 32 && coach.age <= 50, true);
  }
});

Deno.test("ages vary within a role across the league (not a single constant)", () => {
  const result = makeGenerator().generate(INPUT);
  const hcAges = new Set(
    result.filter((c) => c.role === "HC").map((c) => c.age),
  );
  const qbAges = new Set(
    result.filter((c) => c.role === "QB").map((c) => c.age),
  );
  // With 3 HCs and 3 position QB coaches seeded, expect >1 distinct age in
  // at least one of them — the flat constant is gone.
  assertEquals(hcAges.size + qbAges.size > 2, true);
});

Deno.test("contract salaries vary within a role tier across the league", () => {
  const result = makeGenerator().generate(INPUT);
  const hcSalaries = new Set(
    result.filter((c) => c.role === "HC").map((c) => c.contractSalary),
  );
  // 3 HCs, all flat in the stub; the graduated generator must vary at least
  // one of the HCs from its peers.
  assertEquals(hcSalaries.size > 1, true);
});

Deno.test("contract years vary within a role tier across the league", () => {
  const result = makeGenerator().generate(INPUT);
  const ocYears = new Set(
    result.filter((c) => c.role === "OC").map((c) => c.contractYears),
  );
  const positionYears = new Set(
    result.filter((c) => c.role === "QB" || c.role === "RB").map((c) =>
      c.contractYears
    ),
  );
  // Across the league (3 teams) at least one tier shows variance; a flat
  // blueprint would produce a single value everywhere.
  assertEquals(ocYears.size + positionYears.size > 2, true);
});

Deno.test("hiredAt dates spread across multiple years, not all 'last year'", () => {
  const result = makeGenerator().generate(INPUT);
  const years = new Set(result.map((c) => c.hiredAt.getUTCFullYear()));
  // Graduated generator picks tenure per coach; at least two distinct hire
  // years should appear across 39 coaches.
  assertEquals(years.size > 1, true);
});

Deno.test("contract salaries fall within sane bounds per tier", () => {
  const result = makeGenerator().generate(INPUT);
  for (const coach of result) {
    assertEquals(coach.contractSalary > 0, true);
    // HC salary ceiling is generous; position coaches floor is 250k.
    assertEquals(coach.contractSalary >= 250_000, true);
    assertEquals(coach.contractSalary <= 20_000_000, true);
    assertEquals(coach.contractBuyout >= 0, true);
  }
});

Deno.test("seeded generator is deterministic", () => {
  const fixedNow = () => new Date("2026-01-01T00:00:00Z");
  const a = createCoachesGenerator({
    random: seededRandom(42),
    nameGenerator: fixedNameGenerator(),
    now: fixedNow,
  }).generate(INPUT);
  const b = createCoachesGenerator({
    random: seededRandom(42),
    nameGenerator: fixedNameGenerator(),
    now: fixedNow,
  }).generate(INPUT);
  assertEquals(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    assertEquals(a[i].age, b[i].age);
    assertEquals(a[i].contractYears, b[i].contractYears);
    assertEquals(a[i].contractSalary, b[i].contractSalary);
    assertEquals(a[i].hiredAt.getTime(), b[i].hiredAt.getTime());
  }
});
