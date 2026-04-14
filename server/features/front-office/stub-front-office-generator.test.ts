import { assertEquals } from "@std/assert";
import { createStubFrontOfficeGenerator } from "./stub-front-office-generator.ts";

const TEAM_IDS = ["team-1", "team-2", "team-3"];
const INPUT = {
  leagueId: "league-1",
  teamIds: TEAM_IDS,
};

Deno.test("generates front office staff for each team", () => {
  const generator = createStubFrontOfficeGenerator();
  const result = generator.generate(INPUT);

  assertEquals(result.length, TEAM_IDS.length * 2);
  for (const teamId of TEAM_IDS) {
    const teamStaff = result.filter((s) => s.teamId === teamId);
    assertEquals(teamStaff.length, 2);
  }
});

Deno.test("all staff have the correct leagueId and non-empty names", () => {
  const generator = createStubFrontOfficeGenerator();
  const result = generator.generate(INPUT);

  for (const person of result) {
    assertEquals(person.leagueId, INPUT.leagueId);
    assertEquals(person.firstName.length > 0, true);
    assertEquals(person.lastName.length > 0, true);
  }
});

Deno.test("generates no staff when no teams provided", () => {
  const generator = createStubFrontOfficeGenerator();
  const result = generator.generate({ leagueId: "l1", teamIds: [] });
  assertEquals(result.length, 0);
});
