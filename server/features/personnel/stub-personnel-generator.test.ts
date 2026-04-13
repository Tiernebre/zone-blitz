import { assertEquals } from "@std/assert";
import { createStubPersonnelGenerator } from "./stub-personnel-generator.ts";

const TEAM_IDS = ["team-1", "team-2", "team-3"];
const INPUT = {
  leagueId: "league-1",
  seasonId: "season-1",
  teamIds: TEAM_IDS,
  rosterSize: 53,
};

Deno.test("generates correct number of rostered players per team", () => {
  const generator = createStubPersonnelGenerator();
  const result = generator.generate(INPUT);

  const rosteredPlayers = result.players.filter((p) => p.teamId !== null);
  assertEquals(rosteredPlayers.length, TEAM_IDS.length * INPUT.rosterSize);

  for (const teamId of TEAM_IDS) {
    const teamPlayers = rosteredPlayers.filter((p) => p.teamId === teamId);
    assertEquals(teamPlayers.length, INPUT.rosterSize);
  }
});

Deno.test("generates free agents with null teamId", () => {
  const generator = createStubPersonnelGenerator();
  const result = generator.generate(INPUT);

  const freeAgents = result.players.filter((p) => p.teamId === null);
  assertEquals(freeAgents.length, 50);
});

Deno.test("all players have the correct leagueId", () => {
  const generator = createStubPersonnelGenerator();
  const result = generator.generate(INPUT);

  for (const player of result.players) {
    assertEquals(player.leagueId, INPUT.leagueId);
  }
});

Deno.test("generates coaches for each team", () => {
  const generator = createStubPersonnelGenerator();
  const result = generator.generate(INPUT);

  assertEquals(result.coaches.length, TEAM_IDS.length * 5);
  for (const teamId of TEAM_IDS) {
    const teamCoaches = result.coaches.filter((c) => c.teamId === teamId);
    assertEquals(teamCoaches.length, 5);
  }
});

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

Deno.test("generates draft prospects linked to seasonId", () => {
  const generator = createStubPersonnelGenerator();
  const result = generator.generate(INPUT);

  assertEquals(result.draftProspects.length, 250);
  for (const prospect of result.draftProspects) {
    assertEquals(prospect.seasonId, INPUT.seasonId);
  }
});

Deno.test("all generated personnel have non-empty names", () => {
  const generator = createStubPersonnelGenerator();
  const result = generator.generate(INPUT);

  const allPeople = [
    ...result.players,
    ...result.coaches,
    ...result.scouts,
    ...result.frontOfficeStaff,
    ...result.draftProspects,
  ];

  for (const person of allPeople) {
    assertEquals(person.firstName.length > 0, true);
    assertEquals(person.lastName.length > 0, true);
  }
});
