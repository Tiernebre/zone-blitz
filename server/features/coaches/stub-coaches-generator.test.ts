import { assertEquals, assertNotEquals } from "@std/assert";
import type { CoachRole } from "@zone-blitz/shared";
import { createStubCoachesGenerator } from "./stub-coaches-generator.ts";

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

Deno.test("generates a full staff per team", () => {
  const generator = createStubCoachesGenerator();
  const result = generator.generate(INPUT);

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
  const generator = createStubCoachesGenerator();
  const result = generator.generate(INPUT);
  for (const teamId of TEAM_IDS) {
    const hcs = result.filter((c) => c.teamId === teamId && c.role === "HC");
    assertEquals(hcs.length, 1);
  }
});

Deno.test("head coach has no reportsTo and non-null play caller", () => {
  const generator = createStubCoachesGenerator();
  const result = generator.generate(INPUT);
  const hcs = result.filter((c) => c.role === "HC");
  for (const hc of hcs) {
    assertEquals(hc.reportsToId, null);
    assertNotEquals(hc.playCaller, null);
  }
});

Deno.test("coordinators report to their head coach", () => {
  const generator = createStubCoachesGenerator();
  const result = generator.generate(INPUT);
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
  const generator = createStubCoachesGenerator();
  const result = generator.generate(INPUT);
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
  const generator = createStubCoachesGenerator();
  const result = generator.generate(INPUT);
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
  const generator = createStubCoachesGenerator();
  const result = generator.generate(INPUT);
  for (const teamId of TEAM_IDS) {
    const teamCoaches = result.filter((c) => c.teamId === teamId);
    const stc = teamCoaches.find((c) => c.role === "STC");
    const sta = teamCoaches.find((c) => c.role === "ST_ASSISTANT");
    assertEquals(sta?.reportsToId, stc?.id);
  }
});

Deno.test("all coaches have the correct leagueId, non-empty names, plausible age", () => {
  const generator = createStubCoachesGenerator();
  const result = generator.generate(INPUT);
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
  const generator = createStubCoachesGenerator();
  const result = generator.generate(INPUT);
  const ids = new Set(result.map((c) => c.id));
  assertEquals(ids.size, result.length);
});

Deno.test("coaches get a college when a pool is provided", () => {
  const generator = createStubCoachesGenerator();
  const collegeIds = ["college-a", "college-b"];
  const result = generator.generate({ ...INPUT, collegeIds });
  for (const coach of result) {
    assertEquals(collegeIds.includes(coach.collegeId ?? ""), true);
  }
});

Deno.test("coaches have null college when no pool is provided", () => {
  const generator = createStubCoachesGenerator();
  const result = generator.generate(INPUT);
  for (const coach of result) {
    assertEquals(coach.collegeId, null);
  }
});

Deno.test("generates no coaches when no teams provided", () => {
  const generator = createStubCoachesGenerator();
  const result = generator.generate({ leagueId: "l1", teamIds: [] });
  assertEquals(result.length, 0);
});
