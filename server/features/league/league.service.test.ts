import { assertEquals, assertRejects } from "@std/assert";
import { createLeagueService } from "./league.service.ts";
import { DomainError } from "@zone-blitz/shared";
import pino from "pino";
import type { Franchise, League, Team } from "@zone-blitz/shared";
import type { Executor } from "../../db/connection.ts";
import type { TransactionRunner } from "../../db/transaction-runner.ts";
import type { LeagueRepository } from "./league.repository.interface.ts";
import type { SeasonService } from "../season/season.service.interface.ts";
import type { TeamService } from "../team/team.service.interface.ts";
import type { PersonnelService } from "../personnel/personnel.service.interface.ts";
import type { ScheduleService } from "../schedule/schedule.service.interface.ts";
import type { FranchiseService } from "../franchise/franchise.service.interface.ts";
import type { LeagueClockRepository } from "../league-clock/league-clock.repository.ts";
import { FOUNDING_FRANCHISES } from "../franchise/founding-franchises.ts";

const TX_MARKER = { __tx: true };
const FOUNDING_TEAM_COUNT = 8;

function createMockTxRunner(): TransactionRunner {
  return {
    run: (fn) => fn(TX_MARKER as unknown as Executor),
  };
}

function createTestLogger() {
  return pino({ level: "silent" });
}

function createMockLeague(overrides: Partial<League> = {}): League {
  return {
    id: "1",
    name: "Test",
    userTeamId: null,
    numberOfTeams: 8,
    seasonLength: 10,
    salaryCap: 255_000_000,
    capFloorPercent: 89,
    capGrowthRate: 5,
    rosterSize: 53,
    advancePolicy: "commissioner",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastPlayedAt: null,
    ...overrides,
  };
}

function foundingFranchiseFixtures(): Franchise[] {
  return FOUNDING_FRANCHISES.map((f, i) => ({
    id: `f-${i + 1}`,
    name: f.name,
    cityId: `city-${i + 1}`,
    city: f.city,
    state: f.state,
    abbreviation: f.abbreviation,
    primaryColor: f.primaryColor,
    secondaryColor: f.secondaryColor,
    accentColor: f.accentColor,
    conference: "Founding",
    division: "Founding",
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

function foundingTeamFixtures(leagueId: string): Team[] {
  return FOUNDING_FRANCHISES.map((f, i) => ({
    id: `team-${i + 1}`,
    leagueId,
    franchiseId: `f-${i + 1}`,
    name: f.name,
    cityId: `city-${i + 1}`,
    city: f.city,
    state: f.state,
    abbreviation: f.abbreviation,
    primaryColor: f.primaryColor,
    secondaryColor: f.secondaryColor,
    accentColor: f.accentColor,
    conference: "Founding",
    division: "Founding",
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

function createMockRepo(
  overrides: Partial<LeagueRepository> = {},
): LeagueRepository {
  return {
    getAll: () => Promise.resolve([]),
    getById: () => Promise.resolve(undefined),
    create: () => Promise.resolve(createMockLeague({ id: "new-id" })),
    updateUserTeam: () => Promise.resolve(createMockLeague({ id: "new-id" })),
    touchLastPlayed: () => Promise.resolve(createMockLeague({ id: "new-id" })),
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
        offseasonStage: null,
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
    getByLeagueId: () => Promise.resolve([]),
    getById: () => Promise.reject(new DomainError("NOT_FOUND", "not used")),
    createMany: (rows) =>
      Promise.resolve(
        rows.map((r, i) => ({
          id: `team-${i + 1}`,
          leagueId: r.leagueId,
          franchiseId: r.franchiseId,
          name: r.name,
          cityId: r.cityId,
          city: "Test City",
          state: "NY",
          abbreviation: r.abbreviation,
          primaryColor: r.primaryColor,
          secondaryColor: r.secondaryColor,
          accentColor: r.accentColor,
          conference: r.conference,
          division: r.division,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      ),
    ...overrides,
  };
}

function createMockFranchiseService(
  overrides: Partial<FranchiseService> = {},
): FranchiseService {
  return {
    getAll: () => Promise.resolve(foundingFranchiseFixtures()),
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

function createMockLeagueClockRepo(
  overrides: Partial<LeagueClockRepository> = {},
): LeagueClockRepository {
  return {
    getByLeagueId: () => Promise.resolve(undefined),
    upsert: (row) =>
      Promise.resolve({
        leagueId: row.leagueId,
        seasonYear: row.seasonYear,
        phase: row.phase,
        stepIndex: row.stepIndex,
        advancedAt: new Date(),
        advancedByUserId: row.advancedByUserId,
        overrideReason: row.overrideReason ?? null,
        overrideBlockers: row.overrideBlockers ?? null,
        hasCompletedGenesis: row.hasCompletedGenesis ?? false,
      }),
    castVote: () => Promise.reject(new Error("not used")),
    getVotesForStep: () => Promise.resolve([]),
    ...overrides,
  };
}

function createService(overrides: {
  txRunner?: TransactionRunner;
  leagueRepo?: Partial<LeagueRepository>;
  seasonService?: Partial<SeasonService>;
  teamService?: Partial<TeamService>;
  personnelService?: Partial<PersonnelService>;
  scheduleService?: Partial<ScheduleService>;
  franchiseService?: Partial<FranchiseService>;
  leagueClockRepo?: Partial<LeagueClockRepository>;
} = {}) {
  return createLeagueService({
    txRunner: overrides.txRunner ?? createMockTxRunner(),
    leagueRepo: createMockRepo(overrides.leagueRepo),
    seasonService: createMockSeasonService(overrides.seasonService),
    teamService: createMockTeamService(overrides.teamService),
    personnelService: createMockPersonnelService(overrides.personnelService),
    scheduleService: createMockScheduleService(overrides.scheduleService),
    franchiseService: createMockFranchiseService(overrides.franchiseService),
    leagueClockRepo: createMockLeagueClockRepo(overrides.leagueClockRepo),
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
                offseasonStage: null,
                week: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
              {
                id: `${leagueId}-s2`,
                leagueId,
                year: 2,
                phase: "regular_season" as const,
                offseasonStage: null,
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
        offseasonStage: null,
        week: 5,
      });
    },
  );

  await t.step(
    "getAll includes offseasonStage in currentSeason when set",
    async () => {
      const service = createService({
        leagueRepo: {
          getAll: () =>
            Promise.resolve([createMockLeague({ id: "1", name: "League" })]),
        },
        seasonService: {
          getByLeagueId: (leagueId) =>
            Promise.resolve([
              {
                id: `${leagueId}-s1`,
                leagueId,
                year: 1,
                phase: "offseason" as const,
                offseasonStage: "draft" as const,
                week: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ]),
        },
      });

      const result = await service.getAll();
      assertEquals(result[0].currentSeason, {
        year: 1,
        phase: "offseason",
        offseasonStage: "draft",
        week: 1,
      });
    },
  );

  await t.step(
    "getAll embeds userTeam summary when league has userTeamId",
    async () => {
      const teamId = "team-42";
      const service = createService({
        leagueRepo: {
          getAll: () =>
            Promise.resolve([
              createMockLeague({ id: "lg-1", userTeamId: teamId }),
            ]),
        },
        teamService: {
          getById: (id) =>
            Promise.resolve({
              id,
              leagueId: "lg-1",
              franchiseId: "f-1",
              name: "Falcons",
              cityId: "city-1",
              city: "Atlanta",
              state: "GA",
              abbreviation: "ATL",
              primaryColor: "#A71930",
              secondaryColor: "#000",
              accentColor: "#FFF",
              conference: "NFC",
              division: "NFC South",
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
        },
      });

      const result = await service.getAll();
      assertEquals(result[0].userTeam, {
        id: teamId,
        name: "Falcons",
        city: "Atlanta",
        abbreviation: "ATL",
        primaryColor: "#A71930",
      });
    },
  );

  await t.step(
    "getAll returns userTeam null when userTeamId is null",
    async () => {
      const service = createService({
        leagueRepo: {
          getAll: () =>
            Promise.resolve([
              createMockLeague({ id: "lg-1", userTeamId: null }),
            ]),
        },
      });

      const result = await service.getAll();
      assertEquals(result[0].userTeam, null);
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

  // === create (league shell + teams) ===

  await t.step(
    "create creates league shell and 8 teams without generating personnel",
    async () => {
      let personnelCalled = false;
      let scheduleCalled = false;
      let teamsCreated: { leagueId: string; franchiseId: string }[] = [];

      const service = createService({
        leagueRepo: {
          create: (input) =>
            Promise.resolve(
              createMockLeague({ id: "new-id", name: input.name }),
            ),
        },
        teamService: {
          createMany: (rows) => {
            teamsCreated = rows.map((r) => ({
              leagueId: r.leagueId,
              franchiseId: r.franchiseId,
            }));
            return Promise.resolve(
              rows.map((r, i) => ({
                id: `team-${i + 1}`,
                leagueId: r.leagueId,
                franchiseId: r.franchiseId,
                name: r.name,
                cityId: r.cityId,
                city: "Test City",
                state: "NY",
                abbreviation: r.abbreviation,
                primaryColor: r.primaryColor,
                secondaryColor: r.secondaryColor,
                accentColor: r.accentColor,
                conference: r.conference,
                division: r.division,
                createdAt: new Date(),
                updatedAt: new Date(),
              })),
            );
          },
        },
        personnelService: {
          generate: () => {
            personnelCalled = true;
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
          generate: () => {
            scheduleCalled = true;
            return Promise.resolve({ gameCount: 0 });
          },
        },
      });

      const result = await service.create({ name: "New League" });
      assertEquals(result.league.id, "new-id");
      assertEquals(result.teams.length, FOUNDING_TEAM_COUNT);
      assertEquals(teamsCreated.length, FOUNDING_TEAM_COUNT);
      assertEquals(teamsCreated[0].leagueId, "new-id");
      assertEquals(personnelCalled, false);
      assertEquals(scheduleCalled, false);
    },
  );

  await t.step(
    "create persists the founding franchises as teams",
    async () => {
      let receivedFranchiseIds: string[] = [];

      const service = createService({
        leagueRepo: {
          create: () => Promise.resolve(createMockLeague({ id: "new-id" })),
        },
        teamService: {
          createMany: (rows) => {
            receivedFranchiseIds = rows.map((r) => r.franchiseId);
            return Promise.resolve(
              rows.map((r, i) => ({
                id: `team-${i + 1}`,
                leagueId: r.leagueId,
                franchiseId: r.franchiseId,
                name: r.name,
                cityId: r.cityId,
                city: "Test City",
                state: "NY",
                abbreviation: r.abbreviation,
                primaryColor: r.primaryColor,
                secondaryColor: r.secondaryColor,
                accentColor: r.accentColor,
                conference: r.conference,
                division: r.division,
                createdAt: new Date(),
                updatedAt: new Date(),
              })),
            );
          },
        },
      });

      await service.create({ name: "Test" });
      assertEquals(receivedFranchiseIds.length, FOUNDING_TEAM_COUNT);
      for (let i = 0; i < FOUNDING_TEAM_COUNT; i++) {
        assertEquals(receivedFranchiseIds[i], `f-${i + 1}`);
      }
    },
  );

  await t.step(
    "create throws PRECONDITION_FAILED when founding franchises are missing",
    async () => {
      const service = createService({
        franchiseService: { getAll: () => Promise.resolve([]) },
      });

      await assertRejects(
        () => service.create({ name: "New League" }),
        DomainError,
        "founding franchises",
      );
    },
  );

  await t.step(
    "create threads the transaction tx into league repo and team service",
    async () => {
      const received: Record<string, unknown> = {};
      const service = createService({
        leagueRepo: {
          create: (_input, tx) => {
            received.league = tx;
            return Promise.resolve(createMockLeague({ id: "new-id" }));
          },
        },
        teamService: {
          createMany: (_rows, tx) => {
            received.team = tx;
            return Promise.resolve([]);
          },
        },
      });

      await service.create({ name: "New League" });

      assertEquals(received.league, TX_MARKER);
      assertEquals(received.team, TX_MARKER);
    },
  );

  // === found (generation endpoint) ===

  await t.step(
    "found generates personnel, schedule, season, and initializes league_clock",
    async () => {
      let seasonCreated = false;
      let personnelCalled = false;
      let scheduleCalled = false;
      let clockUpserted = false;
      const leagueId = "lg-1";
      const mockTeams = foundingTeamFixtures(leagueId);

      const service = createService({
        leagueRepo: {
          getById: () => Promise.resolve(createMockLeague({ id: leagueId })),
        },
        teamService: {
          getByLeagueId: () => Promise.resolve(mockTeams),
        },
        seasonService: {
          create: (input) => {
            seasonCreated = true;
            assertEquals(input.leagueId, leagueId);
            return Promise.resolve({
              id: "season-1",
              leagueId,
              year: 1,
              phase: "preseason" as const,
              offseasonStage: null,
              week: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          },
        },
        personnelService: {
          generate: (input) => {
            personnelCalled = true;
            assertEquals(input.leagueId, leagueId);
            assertEquals(input.seasonId, "season-1");
            assertEquals(input.teamIds.length, FOUNDING_TEAM_COUNT);
            return Promise.resolve({
              playerCount: 50,
              coachCount: 10,
              scoutCount: 5,
              frontOfficeCount: 0,
              draftProspectCount: 0,
              contractCount: 0,
            });
          },
        },
        scheduleService: {
          generate: (input) => {
            scheduleCalled = true;
            assertEquals(input.seasonId, "season-1");
            return Promise.resolve({ gameCount: 56 });
          },
        },
        leagueClockRepo: {
          getByLeagueId: () => Promise.resolve(undefined),
          upsert: (row) => {
            clockUpserted = true;
            assertEquals(row.leagueId, leagueId);
            assertEquals(row.phase, "genesis_staff_hiring");
            assertEquals(row.seasonYear, 1);
            assertEquals(row.stepIndex, 0);
            return Promise.resolve({
              leagueId: row.leagueId,
              seasonYear: row.seasonYear,
              phase: row.phase,
              stepIndex: row.stepIndex,
              advancedAt: new Date(),
              advancedByUserId: null,
              overrideReason: null,
              overrideBlockers: null,
              hasCompletedGenesis: false,
            });
          },
        },
      });

      const result = await service.found(leagueId);
      assertEquals(result.leagueId, leagueId);
      assertEquals(result.seasonId, "season-1");
      assertEquals(result.playerCount, 50);
      assertEquals(result.coachCount, 10);
      assertEquals(result.scoutCount, 5);
      assertEquals(seasonCreated, true);
      assertEquals(personnelCalled, true);
      assertEquals(scheduleCalled, true);
      assertEquals(clockUpserted, true);
    },
  );

  await t.step(
    "found throws NOT_FOUND when league does not exist",
    async () => {
      const service = createService({
        leagueRepo: { getById: () => Promise.resolve(undefined) },
      });

      await assertRejects(
        () => service.found("missing"),
        DomainError,
        "not found",
      );
    },
  );

  await t.step(
    "found rejects when league_clock already exists (idempotent guard)",
    async () => {
      const service = createService({
        leagueRepo: {
          getById: () => Promise.resolve(createMockLeague({ id: "lg-1" })),
        },
        teamService: {
          getByLeagueId: () => Promise.resolve(foundingTeamFixtures("lg-1")),
        },
        leagueClockRepo: {
          getByLeagueId: () =>
            Promise.resolve({
              leagueId: "lg-1",
              seasonYear: 1,
              phase: "genesis_staff_hiring",
              stepIndex: 0,
              advancedAt: new Date(),
              advancedByUserId: null,
              overrideReason: null,
              overrideBlockers: null,
              hasCompletedGenesis: false,
            }),
        },
      });

      await assertRejects(
        () => service.found("lg-1"),
        DomainError,
        "already been founded",
      );
    },
  );

  await t.step(
    "found threads the transaction tx into all write services",
    async () => {
      const received: Record<string, unknown> = {};
      const leagueId = "lg-1";
      const mockTeams = foundingTeamFixtures(leagueId);

      const service = createService({
        leagueRepo: {
          getById: () => Promise.resolve(createMockLeague({ id: leagueId })),
        },
        teamService: {
          getByLeagueId: () => Promise.resolve(mockTeams),
        },
        seasonService: {
          create: (_input, tx) => {
            received.season = tx;
            return Promise.resolve({
              id: "season-1",
              leagueId,
              year: 1,
              phase: "preseason" as const,
              offseasonStage: null,
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
        leagueClockRepo: {
          getByLeagueId: () => Promise.resolve(undefined),
          upsert: (row, tx) => {
            received.clock = tx;
            return Promise.resolve({
              leagueId: row.leagueId,
              seasonYear: row.seasonYear,
              phase: row.phase,
              stepIndex: row.stepIndex,
              advancedAt: new Date(),
              advancedByUserId: null,
              overrideReason: null,
              overrideBlockers: null,
              hasCompletedGenesis: false,
            });
          },
        },
      });

      await service.found(leagueId);

      assertEquals(received.season, TX_MARKER);
      assertEquals(received.personnel, TX_MARKER);
      assertEquals(received.schedule, TX_MARKER);
      assertEquals(received.clock, TX_MARKER);
    },
  );

  await t.step(
    "found rolls back when a downstream service fails",
    async () => {
      const leagueId = "lg-1";
      const service = createService({
        leagueRepo: {
          getById: () => Promise.resolve(createMockLeague({ id: leagueId })),
        },
        teamService: {
          getByLeagueId: () => Promise.resolve(foundingTeamFixtures(leagueId)),
        },
        scheduleService: {
          generate: () => Promise.reject(new Error("schedule boom")),
        },
      });

      await assertRejects(
        () => service.found(leagueId),
        Error,
        "schedule boom",
      );
    },
  );

  // === getTeams ===

  await t.step(
    "getTeams returns teams for a league",
    async () => {
      const leagueId = "lg-1";
      const mockTeams = foundingTeamFixtures(leagueId).slice(0, 2);

      const service = createService({
        leagueRepo: {
          getById: () => Promise.resolve(createMockLeague({ id: leagueId })),
        },
        teamService: {
          getByLeagueId: () => Promise.resolve(mockTeams),
        },
      });

      const teams = await service.getTeams(leagueId);
      assertEquals(teams.length, 2);
      assertEquals(teams[0].id, "team-1");
      assertEquals(teams[1].id, "team-2");
    },
  );

  await t.step(
    "getTeams throws NOT_FOUND when league does not exist",
    async () => {
      const service = createService({
        leagueRepo: { getById: () => Promise.resolve(undefined) },
      });

      await assertRejects(
        () => service.getTeams("missing"),
        DomainError,
        "not found",
      );
    },
  );

  // === assignUserTeam ===

  await t.step(
    "assignUserTeam validates team exists then updates the league",
    async () => {
      let updatedWith: { id?: string; userTeamId?: string } = {};
      let teamLookedUp: string | undefined;
      const league = createMockLeague({ id: "lg-1" });
      const service = createService({
        leagueRepo: {
          getById: () => Promise.resolve(league),
          updateUserTeam: (id, userTeamId) => {
            updatedWith = { id, userTeamId };
            return Promise.resolve(
              createMockLeague({ id, userTeamId: userTeamId }),
            );
          },
        },
        teamService: {
          getById: (id) => {
            teamLookedUp = id;
            return Promise.resolve({
              id,
              leagueId: "lg-1",
              franchiseId: "f-1",
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
            });
          },
        },
      });

      const result = await service.assignUserTeam("lg-1", "team-1");
      assertEquals(teamLookedUp, "team-1");
      assertEquals(updatedWith, { id: "lg-1", userTeamId: "team-1" });
      assertEquals(result.userTeamId, "team-1");
    },
  );

  await t.step(
    "assignUserTeam throws INVALID_INPUT when team belongs to a different league",
    async () => {
      const service = createService({
        leagueRepo: {
          getById: () => Promise.resolve(createMockLeague({ id: "lg-1" })),
        },
        teamService: {
          getById: (id) =>
            Promise.resolve({
              id,
              leagueId: "other-league",
              franchiseId: "f-1",
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
            }),
        },
      });

      await assertRejects(
        () => service.assignUserTeam("lg-1", "team-1"),
        DomainError,
        "does not belong",
      );
    },
  );

  await t.step(
    "assignUserTeam throws NOT_FOUND when league missing",
    async () => {
      const service = createService({
        leagueRepo: { getById: () => Promise.resolve(undefined) },
      });

      await assertRejects(
        () => service.assignUserTeam("missing", "team-1"),
        DomainError,
        "not found",
      );
    },
  );

  await t.step(
    "assignUserTeam propagates team lookup failure",
    async () => {
      const service = createService({
        leagueRepo: {
          getById: () => Promise.resolve(createMockLeague({ id: "lg-1" })),
        },
        teamService: {
          getById: () =>
            Promise.reject(new DomainError("NOT_FOUND", "Team not found")),
        },
      });

      await assertRejects(
        () => service.assignUserTeam("lg-1", "missing-team"),
        DomainError,
        "Team not found",
      );
    },
  );

  await t.step(
    "touchLastPlayed delegates to repository and returns updated league",
    async () => {
      let touchedId: string | undefined;
      const touchedAt = new Date("2026-04-14T00:00:00Z");
      const service = createService({
        leagueRepo: {
          touchLastPlayed: (id) => {
            touchedId = id;
            return Promise.resolve(
              createMockLeague({ id, lastPlayedAt: touchedAt }),
            );
          },
        },
      });

      const result = await service.touchLastPlayed("lg-1");
      assertEquals(touchedId, "lg-1");
      assertEquals(result.lastPlayedAt, touchedAt);
    },
  );

  await t.step(
    "touchLastPlayed throws NOT_FOUND when league does not exist",
    async () => {
      const service = createService({
        leagueRepo: { touchLastPlayed: () => Promise.resolve(undefined) },
      });

      await assertRejects(
        () => service.touchLastPlayed("missing"),
        DomainError,
        "not found",
      );
    },
  );

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
