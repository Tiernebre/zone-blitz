import { assertEquals, assertRejects } from "@std/assert";
import { createLeagueService } from "./league.service.ts";
import { DomainError } from "@zone-blitz/shared";
import pino from "pino";
import type { League, LeagueRepository } from "@zone-blitz/shared";

function createTestLogger() {
  return pino({ level: "silent" });
}

function createMockLeague(overrides: Partial<League> = {}): League {
  return {
    id: "1",
    name: "Test",
    numberOfTeams: 32,
    seasonLength: 17,
    salaryCap: 255_000_000,
    capFloorPercent: 89,
    capGrowthRate: 5,
    rosterSize: 53,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockRepo(
  overrides: Partial<LeagueRepository> = {},
): LeagueRepository {
  return {
    getAll: () => Promise.resolve([]),
    getById: () => Promise.resolve(undefined),
    create: () => Promise.resolve(createMockLeague({ id: "new-id" })),
    deleteById: () => Promise.resolve(),
    ...overrides,
  };
}

Deno.test("league.service", async (t) => {
  await t.step("getAll returns all leagues from repository", async () => {
    const leagues: League[] = [
      createMockLeague({ id: "1", name: "League One" }),
      createMockLeague({ id: "2", name: "League Two" }),
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
    const league = createMockLeague({ id: "1", name: "Found League" });
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
      const created = createMockLeague({ id: "new-id", name: "New League" });
      const service = createLeagueService({
        leagueRepo: createMockRepo({ create: () => Promise.resolve(created) }),
        log: createTestLogger(),
      });

      const result = await service.create({ name: "New League" });
      assertEquals(result.id, "new-id");
      assertEquals(result.name, "New League");
    },
  );

  await t.step(
    "deleteById delegates to repository when league exists",
    async () => {
      let deletedId: string | undefined;
      const league = createMockLeague({ id: "delete-me", name: "Delete Me" });
      const service = createLeagueService({
        leagueRepo: createMockRepo({
          getById: () => Promise.resolve(league),
          deleteById: (id) => {
            deletedId = id;
            return Promise.resolve();
          },
        }),
        log: createTestLogger(),
      });

      await service.deleteById("delete-me");
      assertEquals(deletedId, "delete-me");
    },
  );

  await t.step(
    "deleteById throws NOT_FOUND when league does not exist",
    async () => {
      const service = createLeagueService({
        leagueRepo: createMockRepo({
          getById: () => Promise.resolve(undefined),
        }),
        log: createTestLogger(),
      });

      await assertRejects(
        () => service.deleteById("missing"),
        DomainError,
        "not found",
      );
    },
  );
});
