import { assertEquals, assertRejects } from "@std/assert";
import { createTeamService } from "./team.service.ts";
import type { TeamRepository } from "./team.repository.interface.ts";
import type { Team } from "@zone-blitz/shared";
import { DomainError } from "@zone-blitz/shared";

function createTestLogger() {
  return {
    child: () => createTestLogger(),
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  } as unknown as import("pino").Logger;
}

function createMockTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: "1",
    leagueId: "league-1",
    franchiseId: "franchise-1",
    name: "Test Team",
    cityId: "city-1",
    city: "Test City",
    state: "NY",
    abbreviation: "TST",
    primaryColor: "#000000",
    secondaryColor: "#FFFFFF",
    accentColor: "#FF0000",
    backstory: "A test franchise backstory.",
    conference: "AFC",
    division: "AFC East",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockTeamRepo(
  overrides: Partial<TeamRepository> = {},
): TeamRepository {
  return {
    createMany: () => Promise.resolve([]),
    getByLeagueId: () => Promise.resolve([]),
    getById: () => Promise.resolve(undefined),
    ...overrides,
  };
}

Deno.test("team.service", async (t) => {
  await t.step("getByLeagueId returns teams from repository", async () => {
    const teams = [
      createMockTeam({ id: "1", name: "Team A" }),
      createMockTeam({ id: "2", name: "Team B" }),
    ];
    const service = createTeamService({
      teamRepo: createMockTeamRepo({
        getByLeagueId: () => Promise.resolve(teams),
      }),
      log: createTestLogger(),
    });

    const result = await service.getByLeagueId("league-1");
    assertEquals(result.length, 2);
    assertEquals(result[0].name, "Team A");
    assertEquals(result[1].name, "Team B");
  });

  await t.step("getByLeagueId returns empty array when no teams", async () => {
    const service = createTeamService({
      teamRepo: createMockTeamRepo(),
      log: createTestLogger(),
    });

    const result = await service.getByLeagueId("league-1");
    assertEquals(result.length, 0);
  });

  await t.step("getById returns team when found", async () => {
    const team = createMockTeam({ id: "42", name: "Found Team" });
    const service = createTeamService({
      teamRepo: createMockTeamRepo({
        getById: () => Promise.resolve(team),
      }),
      log: createTestLogger(),
    });

    const result = await service.getById("42");
    assertEquals(result.name, "Found Team");
  });

  await t.step("getById throws NOT_FOUND when team missing", async () => {
    const service = createTeamService({
      teamRepo: createMockTeamRepo({
        getById: () => Promise.resolve(undefined),
      }),
      log: createTestLogger(),
    });

    await assertRejects(
      () => service.getById("missing"),
      DomainError,
      "not found",
    );
  });

  await t.step("createMany delegates to repository", async () => {
    const inserted = [createMockTeam({ id: "new-1", name: "Fresh" })];
    const service = createTeamService({
      teamRepo: createMockTeamRepo({
        createMany: () => Promise.resolve(inserted),
      }),
      log: createTestLogger(),
    });

    const result = await service.createMany([
      {
        leagueId: "league-1",
        franchiseId: "franchise-1",
        name: "Fresh",
        cityId: "city-1",
        abbreviation: "FRH",
        primaryColor: "#000000",
        secondaryColor: "#FFFFFF",
        accentColor: "#FF0000",
        backstory: "A test backstory.",
        conference: "AFC",
        division: "AFC East",
      },
    ]);
    assertEquals(result.length, 1);
    assertEquals(result[0].name, "Fresh");
  });
});
