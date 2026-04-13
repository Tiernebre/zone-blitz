import { assertEquals } from "@std/assert";
import { createSeasonService } from "./season.service.ts";
import type { SeasonRepository } from "./season.repository.interface.ts";
import type { Season } from "@zone-blitz/shared";

function createTestLogger() {
  return {
    child: () => createTestLogger(),
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  } as unknown as import("pino").Logger;
}

function createMockSeason(overrides: Partial<Season> = {}): Season {
  return {
    id: "season-1",
    leagueId: "league-1",
    year: 1,
    phase: "preseason" as const,
    week: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockSeasonRepo(
  overrides: Partial<SeasonRepository> = {},
): SeasonRepository {
  return {
    getByLeagueId: () => Promise.resolve([]),
    getById: () => Promise.resolve(undefined),
    create: () => Promise.resolve(createMockSeason()),
    ...overrides,
  };
}

Deno.test("season.service", async (t) => {
  await t.step(
    "getByLeagueId returns seasons from repository",
    async () => {
      const seasons = [
        createMockSeason({ id: "s1", year: 1 }),
        createMockSeason({ id: "s2", year: 2 }),
      ];
      const service = createSeasonService({
        seasonRepo: createMockSeasonRepo({
          getByLeagueId: () => Promise.resolve(seasons),
        }),
        log: createTestLogger(),
      });

      const result = await service.getByLeagueId("league-1");
      assertEquals(result.length, 2);
      assertEquals(result[0].year, 1);
      assertEquals(result[1].year, 2);
    },
  );

  await t.step(
    "getByLeagueId returns empty array when no seasons",
    async () => {
      const service = createSeasonService({
        seasonRepo: createMockSeasonRepo(),
        log: createTestLogger(),
      });

      const result = await service.getByLeagueId("league-1");
      assertEquals(result.length, 0);
    },
  );

  await t.step("getById returns season when found", async () => {
    const season = createMockSeason({ id: "s1" });
    const service = createSeasonService({
      seasonRepo: createMockSeasonRepo({
        getById: () => Promise.resolve(season),
      }),
      log: createTestLogger(),
    });

    const result = await service.getById("s1");
    assertEquals(result?.id, "s1");
  });

  await t.step("getById returns undefined when not found", async () => {
    const service = createSeasonService({
      seasonRepo: createMockSeasonRepo(),
      log: createTestLogger(),
    });

    const result = await service.getById("missing");
    assertEquals(result, undefined);
  });

  await t.step("create delegates to repository", async () => {
    let createdInput: unknown;
    const created = createMockSeason({ id: "new-season" });
    const service = createSeasonService({
      seasonRepo: createMockSeasonRepo({
        create: (input) => {
          createdInput = input;
          return Promise.resolve(created);
        },
      }),
      log: createTestLogger(),
    });

    const result = await service.create({ leagueId: "league-1" });
    assertEquals(result.id, "new-season");
    assertEquals(
      (createdInput as { leagueId: string }).leagueId,
      "league-1",
    );
  });
});
