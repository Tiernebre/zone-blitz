import { assertEquals } from "@std/assert";
import { createStubScoutsGenerator } from "./stub-scouts-generator.ts";

const TEAM_IDS = ["team-1", "team-2", "team-3"];
const INPUT = {
  leagueId: "league-1",
  teamIds: TEAM_IDS,
};

Deno.test("generates scouts for each team", () => {
  const generator = createStubScoutsGenerator();
  const result = generator.generate(INPUT);

  assertEquals(result.length, TEAM_IDS.length * 3);
  for (const teamId of TEAM_IDS) {
    const teamScouts = result.filter((s) => s.teamId === teamId);
    assertEquals(teamScouts.length, 3);
  }
});

Deno.test("all scouts have the correct leagueId and non-empty names", () => {
  const generator = createStubScoutsGenerator();
  const result = generator.generate(INPUT);

  for (const scout of result) {
    assertEquals(scout.leagueId, INPUT.leagueId);
    assertEquals(scout.firstName.length > 0, true);
    assertEquals(scout.lastName.length > 0, true);
  }
});

Deno.test("generates no scouts when no teams provided", () => {
  const generator = createStubScoutsGenerator();
  const result = generator.generate({ leagueId: "l1", teamIds: [] });
  assertEquals(result.length, 0);
});
