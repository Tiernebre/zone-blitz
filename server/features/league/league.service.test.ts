import { assertEquals, assertRejects } from "@std/assert";
import { createLeagueService } from "./league.service.ts";
import { DomainError } from "@zone-blitz/shared";
import pino from "pino";
import type { League, LeagueRepository } from "@zone-blitz/shared";

function createTestLogger() {
  return pino({ level: "silent" });
}

function createMockRepo(
  overrides: Partial<LeagueRepository> = {},
): LeagueRepository {
  return {
    getAll: () => Promise.resolve([]),
    getById: () => Promise.resolve(undefined),
    create: () =>
      Promise.resolve({
        id: "new-id",
        name: "Test",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ...overrides,
  };
}

Deno.test("league.service", async (t) => {
  await t.step("getAll returns all leagues from repository", async () => {
    const leagues: League[] = [
      {
        id: "1",
        name: "League One",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "2",
        name: "League Two",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const service = createLeagueService({
      leagueRepo: createMockRepo({ getAll: () => Promise.resolve(leagues) }),
      log: createTestLogger(),
    });

    const result = await service.getAll();
    assertEquals(result.length, 2);
    assertEquals(result[0].name, "League One");
  });

  await t.step("getById returns league when found", async () => {
    const league: League = {
      id: "1",
      name: "Found League",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const service = createLeagueService({
      leagueRepo: createMockRepo({ getById: () => Promise.resolve(league) }),
      log: createTestLogger(),
    });

    const result = await service.getById("1");
    assertEquals(result.name, "Found League");
  });

  await t.step("getById throws NOT_FOUND when league missing", async () => {
    const service = createLeagueService({
      leagueRepo: createMockRepo({ getById: () => Promise.resolve(undefined) }),
      log: createTestLogger(),
    });

    await assertRejects(
      () => service.getById("missing"),
      DomainError,
      "not found",
    );
  });

  await t.step(
    "create delegates to repository and returns league",
    async () => {
      const created: League = {
        id: "new-id",
        name: "New League",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const service = createLeagueService({
        leagueRepo: createMockRepo({ create: () => Promise.resolve(created) }),
        log: createTestLogger(),
      });

      const result = await service.create({ name: "New League" });
      assertEquals(result.id, "new-id");
      assertEquals(result.name, "New League");
    },
  );
});
