import { assertEquals } from "@std/assert";
import {
  PLAYER_ATTRIBUTE_KEYS,
  PLAYER_POSITIONS,
  type PlayerPosition,
} from "@zone-blitz/shared";
import {
  createStubPlayersGenerator,
  ROSTER_POSITION_COMPOSITION,
} from "./stub-players-generator.ts";

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

  const rostered = result.players.filter((p) => p.player.teamId !== null);
  assertEquals(rostered.length, TEAM_IDS.length * INPUT.rosterSize);

  for (const teamId of TEAM_IDS) {
    const teamPlayers = rostered.filter((p) => p.player.teamId === teamId);
    assertEquals(teamPlayers.length, INPUT.rosterSize);
  }
});

Deno.test("generates free agents with null teamId", () => {
  const generator = createStubPlayersGenerator();
  const result = generator.generate(INPUT);

  const freeAgents = result.players.filter((p) => p.player.teamId === null);
  assertEquals(freeAgents.length, 50);
});

Deno.test("all players have the correct leagueId", () => {
  const generator = createStubPlayersGenerator();
  const result = generator.generate(INPUT);

  for (const entry of result.players) {
    assertEquals(entry.player.leagueId, INPUT.leagueId);
  }
});

Deno.test("generates draft prospects linked to seasonId", () => {
  const generator = createStubPlayersGenerator();
  const result = generator.generate(INPUT);

  assertEquals(result.draftProspects.length, 250);
  for (const entry of result.draftProspects) {
    assertEquals(entry.prospect.seasonId, INPUT.seasonId);
  }
});

Deno.test("every player and prospect has a full attribute set", () => {
  const generator = createStubPlayersGenerator();
  const result = generator.generate(INPUT);

  const expectedKeyCount = PLAYER_ATTRIBUTE_KEYS.length * 2;
  for (const entry of [...result.players, ...result.draftProspects]) {
    assertEquals(Object.keys(entry.attributes).length, expectedKeyCount);
    for (const key of PLAYER_ATTRIBUTE_KEYS) {
      const current = (entry.attributes as Record<string, number>)[key];
      const potential =
        (entry.attributes as Record<string, number>)[`${key}Potential`];
      assertEquals(typeof current, "number");
      assertEquals(typeof potential, "number");
      assertEquals(current >= 0 && current <= 100, true);
      assertEquals(potential >= 0 && potential <= 100, true);
    }
  }
});

Deno.test("every player and prospect has identity fields populated", () => {
  const generator = createStubPlayersGenerator();
  const result = generator.generate(INPUT);

  for (const entry of result.players) {
    assertEquals(typeof entry.player.heightInches, "number");
    assertEquals(typeof entry.player.weightPounds, "number");
    assertEquals(typeof entry.player.birthDate, "string");
  }
  for (const entry of result.draftProspects) {
    assertEquals(typeof entry.prospect.heightInches, "number");
    assertEquals(typeof entry.prospect.weightPounds, "number");
    assertEquals(typeof entry.prospect.birthDate, "string");
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

Deno.test("roster composition sums to 53 players", () => {
  const total = ROSTER_POSITION_COMPOSITION.reduce(
    (sum, entry) => sum + entry.count,
    0,
  );
  assertEquals(total, 53);
});

Deno.test(
  "every rostered player receives a position from the known set",
  () => {
    const generator = createStubPlayersGenerator();
    const result = generator.generate(INPUT);
    const validPositions = new Set<PlayerPosition>(PLAYER_POSITIONS);
    for (const entry of result.players) {
      assertEquals(validPositions.has(entry.player.position), true);
    }
  },
);

Deno.test(
  "per-team rostered positions match the 53-man composition",
  () => {
    const generator = createStubPlayersGenerator();
    const result = generator.generate(INPUT);
    for (const teamId of TEAM_IDS) {
      const teamPlayers = result.players.filter(
        (p) => p.player.teamId === teamId,
      );
      const byPosition = new Map<PlayerPosition, number>();
      for (const entry of teamPlayers) {
        byPosition.set(
          entry.player.position,
          (byPosition.get(entry.player.position) ?? 0) + 1,
        );
      }
      for (const { position, count } of ROSTER_POSITION_COMPOSITION) {
        assertEquals(byPosition.get(position) ?? 0, count);
      }
    }
  },
);

Deno.test("every rostered player starts with healthy injury status", () => {
  const generator = createStubPlayersGenerator();
  const result = generator.generate(INPUT);
  for (const entry of result.players) {
    assertEquals(entry.player.injuryStatus, "healthy");
  }
});

Deno.test("every draft prospect receives a valid position", () => {
  const generator = createStubPlayersGenerator();
  const result = generator.generate(INPUT);
  const validPositions = new Set<PlayerPosition>(PLAYER_POSITIONS);
  for (const entry of result.draftProspects) {
    assertEquals(validPositions.has(entry.prospect.position), true);
  }
});

Deno.test("all generated players and prospects have non-empty names", () => {
  const generator = createStubPlayersGenerator();
  const result = generator.generate(INPUT);

  for (const entry of result.players) {
    assertEquals(entry.player.firstName.length > 0, true);
    assertEquals(entry.player.lastName.length > 0, true);
  }
  for (const entry of result.draftProspects) {
    assertEquals(entry.prospect.firstName.length > 0, true);
    assertEquals(entry.prospect.lastName.length > 0, true);
  }
});
