import { assertEquals, assertRejects } from "@std/assert";
import { createLeagueService } from "./league.service.ts";
import { DomainError } from "@zone-blitz/shared";
import pino from "pino";
import type { League } from "@zone-blitz/shared";
import type { Database } from "../../db/connection.ts";
import type { LeagueRepository } from "./league.repository.interface.ts";
import type { SeasonService } from "../season/season.service.interface.ts";
import type { TeamService } from "../team/team.service.interface.ts";
import type { PersonnelService } from "../personnel/personnel.service.interface.ts";
import type { ScheduleService } from "../schedule/schedule.service.interface.ts";

const TX_MARKER = { __tx: true };

function createMockDb(): Database {
  return {
    transaction: <T>(cb: (tx: unknown) => Promise<T>) => cb(TX_MARKER),
  } as unknown as Database;
}

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

function createMockSeasonService(
  overrides: Partial<SeasonService> = {},
): SeasonService {
  return {
    getByLeagueId: () => Promise.resolve([]),
    getById: () => Promise.resolve(undefined),
    create: () =>
      Promise.resolve({
        id: "season-1",
        leagueId: "new-id",
        year: 1,
        phase: "preseason" as const,
        week: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ...overrides,
  };
}

function createMockTeamService(
  overrides: Partial<TeamService> = {},
): TeamService {
  return {
    getAll: () =>
      Promise.resolve([
        {
          id: "team-1",
          name: "Team A",
          cityId: "city-1",
          city: "City A",
          state: "NY",
          abbreviation: "TA",
          primaryColor: "#000",
          secondaryColor: "#FFF",
          accentColor: "#F00",
          conference: "AFC",
          division: "AFC East",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    getById: () => Promise.reject(new DomainError("NOT_FOUND", "not used")),
    ...overrides,
  };
}

function createMockPersonnelService(
  overrides: Partial<PersonnelService> = {},
): PersonnelService {
  return {
    generate: () =>
      Promise.resolve({
        playerCount: 0,
        coachCount: 0,
        scoutCount: 0,
        frontOfficeCount: 0,
        draftProspectCount: 0,
        contractCount: 0,
      }),
    ...overrides,
  };
}

function createMockScheduleService(
  overrides: Partial<ScheduleService> = {},
): ScheduleService {
  return {
    generate: () => Promise.resolve({ gameCount: 0 }),
    ...overrides,
  };
}

function createService(overrides: {
  db?: Database;
  leagueRepo?: Partial<LeagueRepository>;
  seasonService?: Partial<SeasonService>;
  teamService?: Partial<TeamService>;
  personnelService?: Partial<PersonnelService>;
  scheduleService?: Partial<ScheduleService>;
} = {}) {
  return createLeagueService({
    db: overrides.db ?? createMockDb(),
    leagueRepo: createMockRepo(overrides.leagueRepo),
    seasonService: createMockSeasonService(overrides.seasonService),
    teamService: createMockTeamService(overrides.teamService),
    personnelService: createMockPersonnelService(overrides.personnelService),
    scheduleService: createMockScheduleService(overrides.scheduleService),
    log: createTestLogger(),
  });
}

Deno.test("league.service", async (t) => {
  await t.step(
    "getAll returns leagues with their current season embedded",
    async () => {
      const leagues: League[] = [
        createMockLeague({ id: "1", name: "League One" }),
        createMockLeague({ id: "2", name: "League Two" }),
      ];
      const service = createService({
        leagueRepo: { getAll: () => Promise.resolve(leagues) },
        seasonService: {
          getByLeagueId: (leagueId) =>
            Promise.resolve([
              {
                id: `${leagueId}-s1`,
                leagueId,
                year: 1,
                phase: "preseason" as const,
                week: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
              {
                id: `${leagueId}-s2`,
                leagueId,
                year: 2,
                phase: "regular_season" as const,
                week: 5,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ]),
        },
      });

      const result = await service.getAll();
      assertEquals(result.length, 2);
      assertEquals(result[0].name, "League One");
      assertEquals(result[0].currentSeason, {
        year: 2,
        phase: "regular_season",
        week: 5,
      });
    },
  );

  await t.step(
    "getAll returns currentSeason null when a league has no seasons",
    async () => {
      const service = createService({
        leagueRepo: {
          getAll: () => Promise.resolve([createMockLeague({ id: "1" })]),
        },
        seasonService: { getByLeagueId: () => Promise.resolve([]) },
      });

      const result = await service.getAll();
      assertEquals(result[0].currentSeason, null);
    },
  );

  await t.step("getById returns league when found", async () => {
    const league = createMockLeague({ id: "1", name: "Found League" });
    const service = createService({
      leagueRepo: { getById: () => Promise.resolve(league) },
    });

    const result = await service.getById("1");
    assertEquals(result.name, "Found League");
  });

  await t.step("getById throws NOT_FOUND when league missing", async () => {
    const service = createService({
      leagueRepo: { getById: () => Promise.resolve(undefined) },
    });

    await assertRejects(
      () => service.getById("missing"),
      DomainError,
      "not found",
    );
  });

  await t.step("create orchestrates league world generation", async () => {
    let seasonCreated = false;
    let personnelCalled = false;
    let scheduleCalled = false;

    const service = createService({
      seasonService: {
        create: (input) => {
          seasonCreated = true;
          assertEquals(input.leagueId, "new-id");
          return Promise.resolve({
            id: "season-1",
            leagueId: "new-id",
            year: 1,
            phase: "preseason" as const,
            week: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        },
      },
      personnelService: {
        generate: (input) => {
          personnelCalled = true;
          assertEquals(input.leagueId, "new-id");
          assertEquals(input.seasonId, "season-1");
          assertEquals(input.rosterSize, 53);
          assertEquals(input.salaryCap, 255_000_000);
          return Promise.resolve({
            playerCount: 1,
            coachCount: 0,
            scoutCount: 0,
            frontOfficeCount: 0,
            draftProspectCount: 0,
            contractCount: 1,
          });
        },
      },
      scheduleService: {
        generate: (input) => {
          scheduleCalled = true;
          assertEquals(input.seasonId, "season-1");
          assertEquals(input.seasonLength, 17);
          return Promise.resolve({ gameCount: 0 });
        },
      },
    });

    const result = await service.create({ name: "New League" });
    assertEquals(result.id, "new-id");
    assertEquals(seasonCreated, true);
    assertEquals(personnelCalled, true);
    assertEquals(scheduleCalled, true);
  });

  await t.step(
    "create throws PRECONDITION_FAILED when no teams are seeded",
    async () => {
      const service = createService({
        teamService: { getAll: () => Promise.resolve([]) },
      });

      await assertRejects(
        () => service.create({ name: "New League" }),
        DomainError,
        "no teams",
      );
    },
  );

  await t.step(
    "create threads the transaction tx into every write service",
    async () => {
      const received: Record<string, unknown> = {};
      const service = createService({
        leagueRepo: {
          create: (_input, tx) => {
            received.league = tx;
            return Promise.resolve(createMockLeague({ id: "new-id" }));
          },
        },
        seasonService: {
          create: (_input, tx) => {
            received.season = tx;
            return Promise.resolve({
              id: "season-1",
              leagueId: "new-id",
              year: 1,
              phase: "preseason" as const,
              week: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          },
        },
        personnelService: {
          generate: (_input, tx) => {
            received.personnel = tx;
            return Promise.resolve({
              playerCount: 0,
              coachCount: 0,
              scoutCount: 0,
              frontOfficeCount: 0,
              draftProspectCount: 0,
              contractCount: 0,
            });
          },
        },
        scheduleService: {
          generate: (_input, tx) => {
            received.schedule = tx;
            return Promise.resolve({ gameCount: 0 });
          },
        },
      });

      await service.create({ name: "New League" });

      assertEquals(received.league, TX_MARKER);
      assertEquals(received.season, TX_MARKER);
      assertEquals(received.personnel, TX_MARKER);
      assertEquals(received.schedule, TX_MARKER);
    },
  );

  await t.step(
    "create rejects and rolls back when a downstream service fails",
    async () => {
      let personnelCalled = false;
      const service = createService({
        personnelService: {
          generate: () => {
            personnelCalled = true;
            return Promise.resolve({
              playerCount: 1,
              coachCount: 0,
              scoutCount: 0,
              frontOfficeCount: 0,
              draftProspectCount: 0,
              contractCount: 0,
            });
          },
        },
        scheduleService: {
          generate: () => Promise.reject(new Error("schedule boom")),
        },
      });

      await assertRejects(
        () => service.create({ name: "New League" }),
        Error,
        "schedule boom",
      );
      assertEquals(personnelCalled, true);
    },
  );

  await t.step("create returns the league", async () => {
    const service = createService();
    const result = await service.create({ name: "New League" });
    assertEquals(result.id, "new-id");
    assertEquals(result.name, "Test");
  });

  await t.step(
    "deleteById delegates to repository when league exists",
    async () => {
      let deletedId: string | undefined;
      const league = createMockLeague({ id: "delete-me", name: "Delete Me" });
      const service = createService({
        leagueRepo: {
          getById: () => Promise.resolve(league),
          deleteById: (id) => {
            deletedId = id;
            return Promise.resolve();
          },
        },
      });

      await service.deleteById("delete-me");
      assertEquals(deletedId, "delete-me");
    },
  );

  await t.step(
    "deleteById throws NOT_FOUND when league does not exist",
    async () => {
      const service = createService({
        leagueRepo: { getById: () => Promise.resolve(undefined) },
      });

      await assertRejects(
        () => service.deleteById("missing"),
        DomainError,
        "not found",
      );
    },
  );
});
