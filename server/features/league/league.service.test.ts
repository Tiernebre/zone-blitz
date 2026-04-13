import { assertEquals, assertRejects } from "@std/assert";
import { createLeagueService } from "./league.service.ts";
import { DomainError } from "@zone-blitz/shared";
import pino from "pino";
import type { League, ScheduleGenerator } from "@zone-blitz/shared";
import type { PersonnelGenerator } from "../personnel/personnel.generator.interface.ts";
import type { LeagueRepository } from "./league.repository.interface.ts";
import type { SeasonRepository } from "../season/season.repository.interface.ts";
import type { TeamRepository } from "../team/team.repository.interface.ts";

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

function createMockSeasonRepo(
  overrides: Partial<SeasonRepository> = {},
): SeasonRepository {
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

function createMockTeamRepo(
  overrides: Partial<TeamRepository> = {},
): TeamRepository {
  return {
    getAll: () =>
      Promise.resolve([
        {
          id: "team-1",
          name: "Team A",
          city: "City A",
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
    getById: () => Promise.resolve(undefined),
    ...overrides,
  };
}

function createMockPersonnelGenerator(): PersonnelGenerator {
  return {
    generate: () => ({
      players: [
        {
          leagueId: "new-id",
          teamId: "team-1",
          firstName: "John",
          lastName: "Doe",
        },
      ],
      coaches: [
        {
          leagueId: "new-id",
          teamId: "team-1",
          firstName: "Coach",
          lastName: "Smith",
        },
      ],
      scouts: [
        {
          leagueId: "new-id",
          teamId: "team-1",
          firstName: "Scout",
          lastName: "Jones",
        },
      ],
      frontOfficeStaff: [
        {
          leagueId: "new-id",
          teamId: "team-1",
          firstName: "Staff",
          lastName: "Brown",
        },
      ],
      draftProspects: [
        { seasonId: "season-1", firstName: "Prospect", lastName: "Wilson" },
      ],
    }),
    generateContracts: () => [
      {
        playerId: "player-1",
        teamId: "team-1",
        totalYears: 3,
        currentYear: 1,
        totalSalary: 15_000_000,
        annualSalary: 5_000_000,
        guaranteedMoney: 5_000_000,
        signingBonus: 0,
      },
    ],
  };
}

function createMockScheduleGenerator(): ScheduleGenerator {
  return {
    generate: () => [
      {
        seasonId: "season-1",
        week: 1,
        homeTeamId: "team-1",
        awayTeamId: "team-2",
      },
    ],
  };
}

// deno-lint-ignore no-explicit-any
function createMockDb(): any {
  const mockInsert = () => ({
    values: (v: unknown[]) => {
      if (!Array.isArray(v) || v.length === 0) {
        throw new Error("values() must be called with at least one value");
      }
      return {
        returning: () =>
          Promise.resolve([{ id: "player-1", teamId: "team-1" }]),
      };
    },
  });
  return { insert: mockInsert };
}

function createService(overrides: {
  leagueRepo?: Partial<LeagueRepository>;
  seasonRepo?: Partial<SeasonRepository>;
  teamRepo?: Partial<TeamRepository>;
  personnelGenerator?: PersonnelGenerator;
  scheduleGenerator?: ScheduleGenerator;
} = {}) {
  return createLeagueService({
    leagueRepo: createMockRepo(overrides.leagueRepo),
    seasonRepo: createMockSeasonRepo(overrides.seasonRepo),
    teamRepo: createMockTeamRepo(overrides.teamRepo),
    personnelGenerator: overrides.personnelGenerator ??
      createMockPersonnelGenerator(),
    scheduleGenerator: overrides.scheduleGenerator ??
      createMockScheduleGenerator(),
    db: createMockDb(),
    log: createTestLogger(),
  });
}

Deno.test("league.service", async (t) => {
  await t.step("getAll returns all leagues from repository", async () => {
    const leagues: League[] = [
      createMockLeague({ id: "1", name: "League One" }),
      createMockLeague({ id: "2", name: "League Two" }),
    ];
    const service = createService({
      leagueRepo: { getAll: () => Promise.resolve(leagues) },
    });

    const result = await service.getAll();
    assertEquals(result.length, 2);
    assertEquals(result[0].name, "League One");
  });

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
    let personnelGenerated = false;
    let contractsGenerated = false;
    let scheduleGenerated = false;

    const service = createService({
      seasonRepo: {
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
      personnelGenerator: {
        generate: (input) => {
          personnelGenerated = true;
          assertEquals(input.leagueId, "new-id");
          assertEquals(input.seasonId, "season-1");
          assertEquals(input.rosterSize, 53);
          return {
            players: [
              {
                leagueId: "new-id",
                teamId: "team-1",
                firstName: "J",
                lastName: "D",
              },
            ],
            coaches: [],
            scouts: [],
            frontOfficeStaff: [],
            draftProspects: [],
          };
        },
        generateContracts: (input) => {
          contractsGenerated = true;
          assertEquals(input.salaryCap, 255_000_000);
          return [];
        },
      },
      scheduleGenerator: {
        generate: (input) => {
          scheduleGenerated = true;
          assertEquals(input.seasonId, "season-1");
          return [];
        },
      },
    });

    const result = await service.create({ name: "New League" });
    assertEquals(result.id, "new-id");
    assertEquals(seasonCreated, true);
    assertEquals(personnelGenerated, true);
    assertEquals(contractsGenerated, true);
    assertEquals(scheduleGenerated, true);
  });

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
