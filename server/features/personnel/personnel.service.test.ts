import { assertEquals } from "@std/assert";
import { createPersonnelService } from "./personnel.service.ts";
import type { PlayersService } from "../players/players.service.interface.ts";
import type { CoachesService } from "../coaches/coaches.service.interface.ts";
import type { ScoutsService } from "../scouts/scouts.service.interface.ts";
import type { FrontOfficeService } from "../front-office/front-office.service.interface.ts";
import type { DepthChartPublisher } from "../depth-chart/depth-chart.publisher.interface.ts";

function createTestLogger() {
  return {
    child: () => createTestLogger(),
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  } as unknown as import("pino").Logger;
}

function createMockPlayersService(
  overrides: Partial<PlayersService> = {},
): PlayersService {
  return {
    generate: () =>
      Promise.resolve({
        playerCount: 0,
        draftProspectCount: 0,
        contractCount: 0,
      }),
    getDetail: () => Promise.reject(new Error("not implemented in mock")),
    findDraftEligiblePlayers: () => Promise.resolve([]),
    draftPlayer: () => Promise.reject(new Error("draftPlayer not stubbed")),
    ...overrides,
  };
}

function createMockCoachesService(
  overrides: Partial<CoachesService> = {},
): CoachesService {
  return {
    generate: () => Promise.resolve({ coachCount: 0 }),
    generatePool: () => Promise.resolve({ coachCount: 0 }),
    getStaffTree: () => Promise.resolve([]),
    getCoachDetail: () =>
      Promise.reject(new Error("getCoachDetail not stubbed")),
    getFingerprint: () =>
      Promise.resolve({ offense: null, defense: null, overrides: {} }),
    ...overrides,
  };
}

function createMockScoutsService(
  overrides: Partial<ScoutsService> = {},
): ScoutsService {
  return {
    generate: () => Promise.resolve({ scoutCount: 0 }),
    getStaffTree: () => Promise.resolve([]),
    getScoutDetail: () =>
      Promise.reject(new Error("not used in personnel tests")),
    ...overrides,
  };
}

function createMockFrontOfficeService(
  overrides: Partial<FrontOfficeService> = {},
): FrontOfficeService {
  return {
    generate: () => Promise.resolve({ frontOfficeCount: 0 }),
    ...overrides,
  };
}

function createMockDepthChartPublisher(
  overrides: Partial<DepthChartPublisher> = {},
): DepthChartPublisher {
  return {
    publishForTeams: () => Promise.resolve({ entryCount: 0 }),
    ...overrides,
  };
}

Deno.test("personnel.service", async (t) => {
  await t.step(
    "generate delegates to all four services and aggregates counts",
    async () => {
      let playersServiceInput:
        | {
          leagueId: string;
          seasonId: string;
          teamIds: string[];
          rosterSize: number;
          salaryCap: number;
        }
        | undefined;
      const playersService = createMockPlayersService({
        generate: (input) => {
          playersServiceInput = input;
          return Promise.resolve({
            playerCount: 2,
            draftProspectCount: 1,
            contractCount: 2,
          });
        },
      });

      let poolInput:
        | { leagueId: string; numberOfTeams: number }
        | undefined;
      const coachesService = createMockCoachesService({
        generatePool: (input) => {
          poolInput = input;
          return Promise.resolve({ coachCount: 5 });
        },
      });

      let scoutsServiceInput:
        | { leagueId: string; teamIds: string[] }
        | undefined;
      const scoutsService = createMockScoutsService({
        generate: (input) => {
          scoutsServiceInput = input;
          return Promise.resolve({ scoutCount: 3 });
        },
      });

      let frontOfficeServiceInput:
        | { leagueId: string; teamIds: string[] }
        | undefined;
      const frontOfficeService = createMockFrontOfficeService({
        generate: (input) => {
          frontOfficeServiceInput = input;
          return Promise.resolve({ frontOfficeCount: 2 });
        },
      });

      const service = createPersonnelService({
        playersService,
        coachesService,
        scoutsService,
        frontOfficeService,
        depthChartPublisher: createMockDepthChartPublisher(),
        log: createTestLogger(),
      });

      const result = await service.generate({
        leagueId: "l1",
        seasonId: "s1",
        teamIds: ["t1"],
        rosterSize: 2,
        salaryCap: 255_000_000,
      });

      assertEquals(result.playerCount, 2);
      assertEquals(result.coachCount, 5);
      assertEquals(result.scoutCount, 3);
      assertEquals(result.frontOfficeCount, 2);
      assertEquals(result.draftProspectCount, 1);
      assertEquals(result.contractCount, 2);

      assertEquals(playersServiceInput?.leagueId, "l1");
      assertEquals(playersServiceInput?.seasonId, "s1");
      assertEquals(playersServiceInput?.teamIds, ["t1"]);
      assertEquals(playersServiceInput?.rosterSize, 2);
      assertEquals(playersServiceInput?.salaryCap, 255_000_000);

      assertEquals(poolInput?.leagueId, "l1");
      assertEquals(poolInput?.numberOfTeams, 1);

      assertEquals(scoutsServiceInput?.leagueId, "l1");
      assertEquals(scoutsServiceInput?.teamIds, ["t1"]);

      assertEquals(frontOfficeServiceInput?.leagueId, "l1");
      assertEquals(frontOfficeServiceInput?.teamIds, ["t1"]);
    },
  );

  await t.step(
    "generate forwards tx to every downstream service",
    async () => {
      const marker = { __tx: true };
      const received: Record<string, unknown> = {};
      const service = createPersonnelService({
        playersService: createMockPlayersService({
          generate: (_input, tx) => {
            received.players = tx;
            return Promise.resolve({
              playerCount: 0,
              draftProspectCount: 0,
              contractCount: 0,
            });
          },
        }),
        coachesService: createMockCoachesService({
          generatePool: (_input, tx) => {
            received.coaches = tx;
            return Promise.resolve({ coachCount: 0 });
          },
        }),
        scoutsService: createMockScoutsService({
          generate: (_input, tx) => {
            received.scouts = tx;
            return Promise.resolve({ scoutCount: 0 });
          },
        }),
        frontOfficeService: createMockFrontOfficeService({
          generate: (_input, tx) => {
            received.frontOffice = tx;
            return Promise.resolve({ frontOfficeCount: 0 });
          },
        }),
        depthChartPublisher: createMockDepthChartPublisher({
          publishForTeams: (_input, tx) => {
            received.depthChart = tx;
            return Promise.resolve({ entryCount: 0 });
          },
        }),
        log: createTestLogger(),
      });

      await service.generate(
        {
          leagueId: "l1",
          seasonId: "s1",
          teamIds: ["t1"],
          rosterSize: 1,
          salaryCap: 1,
        },
        marker as unknown as import("../../db/connection.ts").Executor,
      );

      assertEquals(received.players, marker);
      assertEquals(received.depthChart, marker);
      assertEquals(received.coaches, marker);
      assertEquals(received.scouts, marker);
      assertEquals(received.frontOffice, marker);
    },
  );

  await t.step(
    "generate creates only an unassigned candidate pool — does not pre-assign coaches to teams",
    async () => {
      let generateCalled = false;
      let poolInput:
        | { leagueId: string; numberOfTeams: number }
        | undefined;
      const coachesService = createMockCoachesService({
        generatePool: (input) => {
          poolInput = input;
          return Promise.resolve({ coachCount: 10 });
        },
        generate: () => {
          generateCalled = true;
          return Promise.resolve({ coachCount: 5 });
        },
      });

      const service = createPersonnelService({
        playersService: createMockPlayersService(),
        coachesService,
        scoutsService: createMockScoutsService(),
        frontOfficeService: createMockFrontOfficeService(),
        depthChartPublisher: createMockDepthChartPublisher(),
        log: createTestLogger(),
      });

      const result = await service.generate({
        leagueId: "l1",
        seasonId: "s1",
        teamIds: ["t1", "t2"],
        rosterSize: 2,
        salaryCap: 255_000_000,
      });

      assertEquals(
        generateCalled,
        false,
        "coachesService.generate() must not be called — coaches should remain unassigned until explicitly hired",
      );
      assertEquals(poolInput?.leagueId, "l1");
      assertEquals(poolInput?.numberOfTeams, 2);
      assertEquals(
        result.coachCount,
        10,
        "coachCount should reflect the candidate pool size",
      );
    },
  );

  await t.step(
    "generate returns zero counts when all services return zero",
    async () => {
      const service = createPersonnelService({
        playersService: createMockPlayersService(),
        coachesService: createMockCoachesService(),
        scoutsService: createMockScoutsService(),
        frontOfficeService: createMockFrontOfficeService(),
        depthChartPublisher: createMockDepthChartPublisher(),
        log: createTestLogger(),
      });

      const result = await service.generate({
        leagueId: "l1",
        seasonId: "s1",
        teamIds: [],
        rosterSize: 0,
        salaryCap: 0,
      });

      assertEquals(result.playerCount, 0);
      assertEquals(result.coachCount, 0);
      assertEquals(result.scoutCount, 0);
      assertEquals(result.frontOfficeCount, 0);
      assertEquals(result.draftProspectCount, 0);
      assertEquals(result.contractCount, 0);
    },
  );
});
