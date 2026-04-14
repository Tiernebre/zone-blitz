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
    name: "Test Team",
    cityId: "city-1",
    city: "Test City",
    state: "NY",
    abbreviation: "TST",
    primaryColor: "#000000",
    secondaryColor: "#FFFFFF",
    accentColor: "#FF0000",
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
    getAll: () => Promise.resolve([]),
    getById: () => Promise.resolve(undefined),
    ...overrides,
  };
}

Deno.test("team.service", async (t) => {
  await t.step("getAll returns all teams from repository", async () => {
    const teams = [
      createMockTeam({ id: "1", name: "Team A" }),
      createMockTeam({ id: "2", name: "Team B" }),
    ];
    const service = createTeamService({
      teamRepo: createMockTeamRepo({ getAll: () => Promise.resolve(teams) }),
      log: createTestLogger(),
    });

    const result = await service.getAll();
    assertEquals(result.length, 2);
    assertEquals(result[0].name, "Team A");
    assertEquals(result[1].name, "Team B");
  });

  await t.step("getAll returns empty array when no teams", async () => {
    const service = createTeamService({
      teamRepo: createMockTeamRepo(),
      log: createTestLogger(),
    });

    const result = await service.getAll();
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
});
