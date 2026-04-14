import { assertEquals } from "@std/assert";
import { createStubCoachesGenerator } from "./stub-coaches-generator.ts";

const TEAM_IDS = ["team-1", "team-2", "team-3"];
const INPUT = {
  leagueId: "league-1",
  teamIds: TEAM_IDS,
};

Deno.test("generates coaches for each team", () => {
  const generator = createStubCoachesGenerator();
  const result = generator.generate(INPUT);

  assertEquals(result.length, TEAM_IDS.length * 5);
  for (const teamId of TEAM_IDS) {
    const teamCoaches = result.filter((c) => c.teamId === teamId);
    assertEquals(teamCoaches.length, 5);
  }
});

Deno.test("all coaches have the correct leagueId and non-empty names", () => {
  const generator = createStubCoachesGenerator();
  const result = generator.generate(INPUT);

  for (const coach of result) {
    assertEquals(coach.leagueId, INPUT.leagueId);
    assertEquals(coach.firstName.length > 0, true);
    assertEquals(coach.lastName.length > 0, true);
  }
});

Deno.test("generates no coaches when no teams provided", () => {
  const generator = createStubCoachesGenerator();
  const result = generator.generate({ leagueId: "l1", teamIds: [] });
  assertEquals(result.length, 0);
});
