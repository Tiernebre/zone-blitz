import { assertEquals } from "@std/assert";
import { createStubPersonnelGenerator } from "./stub-personnel-generator.ts";

const TEAM_IDS = ["team-1", "team-2", "team-3"];
const INPUT = {
  leagueId: "league-1",
  teamIds: TEAM_IDS,
};

Deno.test("generates scouts for each team", () => {
  const generator = createStubPersonnelGenerator();
  const result = generator.generate(INPUT);

  assertEquals(result.scouts.length, TEAM_IDS.length * 3);
  for (const teamId of TEAM_IDS) {
    const teamScouts = result.scouts.filter((s) => s.teamId === teamId);
    assertEquals(teamScouts.length, 3);
  }
});

Deno.test("generates front office staff for each team", () => {
  const generator = createStubPersonnelGenerator();
  const result = generator.generate(INPUT);

  assertEquals(result.frontOfficeStaff.length, TEAM_IDS.length * 2);
  for (const teamId of TEAM_IDS) {
    const teamStaff = result.frontOfficeStaff.filter(
      (s) => s.teamId === teamId,
    );
    assertEquals(teamStaff.length, 2);
  }
});

Deno.test("all generated personnel have non-empty names and correct leagueId", () => {
  const generator = createStubPersonnelGenerator();
  const result = generator.generate(INPUT);

  const allPeople = [...result.scouts, ...result.frontOfficeStaff];

  for (const person of allPeople) {
    assertEquals(person.firstName.length > 0, true);
    assertEquals(person.lastName.length > 0, true);
    assertEquals(person.leagueId, INPUT.leagueId);
  }
});
