import { assertEquals } from "@std/assert";
import { createStubPlayersGenerator } from "./stub-players-generator.ts";

const TEAM_IDS = ["team-1", "team-2", "team-3"];
const INPUT = {
  leagueId: "league-1",
  seasonId: "season-1",
  teamIds: TEAM_IDS,
  rosterSize: 53,
};

Deno.test("generates correct number of rostered players per team", () => {
  const generator = createStubPlayersGenerator();
  const result = generator.generate(INPUT);

  const rosteredPlayers = result.players.filter((p) => p.teamId !== null);
  assertEquals(rosteredPlayers.length, TEAM_IDS.length * INPUT.rosterSize);

  for (const teamId of TEAM_IDS) {
    const teamPlayers = rosteredPlayers.filter((p) => p.teamId === teamId);
    assertEquals(teamPlayers.length, INPUT.rosterSize);
  }
});

Deno.test("generates free agents with null teamId", () => {
  const generator = createStubPlayersGenerator();
  const result = generator.generate(INPUT);

  const freeAgents = result.players.filter((p) => p.teamId === null);
  assertEquals(freeAgents.length, 50);
});

Deno.test("all players have the correct leagueId", () => {
  const generator = createStubPlayersGenerator();
  const result = generator.generate(INPUT);

  for (const player of result.players) {
    assertEquals(player.leagueId, INPUT.leagueId);
  }
});

Deno.test("generates draft prospects linked to seasonId", () => {
  const generator = createStubPlayersGenerator();
  const result = generator.generate(INPUT);

  assertEquals(result.draftProspects.length, 250);
  for (const prospect of result.draftProspects) {
    assertEquals(prospect.seasonId, INPUT.seasonId);
  }
});

Deno.test("generates contracts for rostered players only", () => {
  const generator = createStubPlayersGenerator();
  const players = [
    { id: "p1", teamId: "team-1" },
    { id: "p2", teamId: "team-1" },
    { id: "p3", teamId: null },
  ];

  const contracts = generator.generateContracts({
    salaryCap: 255_000_000,
    players,
  });

  assertEquals(contracts.length, 2);
  assertEquals(contracts.every((c) => c.teamId === "team-1"), true);
});

Deno.test("stub contracts distribute salary evenly under cap", () => {
  const generator = createStubPlayersGenerator();
  const salaryCap = 255_000_000;
  const players = Array.from({ length: 53 }, (_, i) => ({
    id: `p${i}`,
    teamId: "team-1",
  }));

  const contracts = generator.generateContracts({ salaryCap, players });

  const totalAnnual = contracts.reduce((sum, c) => sum + c.annualSalary, 0);
  assertEquals(totalAnnual <= salaryCap, true);
  assertEquals(contracts.every((c) => c.totalYears === 3), true);
  assertEquals(contracts.every((c) => c.currentYear === 1), true);
});

Deno.test("all generated players and prospects have non-empty names", () => {
  const generator = createStubPlayersGenerator();
  const result = generator.generate(INPUT);

  const allPeople = [...result.players, ...result.draftProspects];

  for (const person of allPeople) {
    assertEquals(person.firstName.length > 0, true);
    assertEquals(person.lastName.length > 0, true);
  }
});
