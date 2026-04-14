import { assertEquals } from "@std/assert";
import type {
  ActiveRoster,
  DepthChart,
  PLAYER_ATTRIBUTE_KEYS as _PLAYER_ATTRIBUTE_KEYS,
  PlayerAttributes,
  RosterStatistics,
} from "@zone-blitz/shared";
import { PLAYER_ATTRIBUTE_KEYS } from "@zone-blitz/shared";
import { createRosterService } from "./roster.service.ts";
import type { RosterRepository } from "./roster.repository.interface.ts";
import type { CoachesService } from "../coaches/coaches.service.interface.ts";

function createTestLogger() {
  return {
    child: () => createTestLogger(),
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  } as unknown as import("pino").Logger;
}

function createMockRepo(
  overrides: Partial<RosterRepository> = {},
): RosterRepository {
  const emptyActive: ActiveRoster = {
    leagueId: "l",
    teamId: "t",
    players: [],
    positionGroups: [],
    totalCap: 0,
    salaryCap: 0,
    capSpace: 0,
  };
  const emptyChart: DepthChart = {
    leagueId: "l",
    teamId: "t",
    slots: [],
    inactives: [],
    lastUpdatedAt: null,
    lastUpdatedBy: null,
  };
  const emptyStats: RosterStatistics = {
    leagueId: "l",
    teamId: "t",
    seasonId: null,
    rows: [],
  };
  return {
    getActiveRoster: () => Promise.resolve(emptyActive),
    getDepthChart: () => Promise.resolve(emptyChart),
    getStatistics: () => Promise.resolve(emptyStats),
    getActivePlayersForFit: () => Promise.resolve([]),
    ...overrides,
  };
}

function createMockCoachesService(
  overrides: Partial<CoachesService> = {},
): CoachesService {
  return {
    generate: () => Promise.resolve({ coachCount: 0 }),
    getStaffTree: () => Promise.resolve([]),
    getCoachDetail: () =>
      Promise.reject(new Error("getCoachDetail not stubbed")),
    getFingerprint: () =>
      Promise.resolve({ offense: null, defense: null, overrides: {} }),
    ...overrides,
  };
}

function attributes(
  overrides: Partial<PlayerAttributes> = {},
): PlayerAttributes {
  const base: Partial<PlayerAttributes> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    (base as Record<string, number>)[key] = 50;
    (base as Record<string, number>)[`${key}Potential`] = 50;
  }
  return { ...base, ...overrides } as PlayerAttributes;
}

Deno.test("roster.service", async (t) => {
  await t.step(
    "getActiveRoster forwards leagueId and teamId to repository",
    async () => {
      let receivedLeague: string | undefined;
      let receivedTeam: string | undefined;
      const service = createRosterService({
        repo: createMockRepo({
          getActiveRoster: (leagueId, teamId) => {
            receivedLeague = leagueId;
            receivedTeam = teamId;
            return Promise.resolve({
              leagueId,
              teamId,
              players: [],
              positionGroups: [],
              totalCap: 0,
              salaryCap: 1,
              capSpace: 1,
            });
          },
        }),
        coachesService: createMockCoachesService(),
        log: createTestLogger(),
      });

      const result = await service.getActiveRoster("lg-1", "tm-1");
      assertEquals(receivedLeague, "lg-1");
      assertEquals(receivedTeam, "tm-1");
      assertEquals(result.salaryCap, 1);
    },
  );

  await t.step("getDepthChart delegates to repository", async () => {
    let called = false;
    const service = createRosterService({
      repo: createMockRepo({
        getDepthChart: (leagueId, teamId) => {
          called = true;
          return Promise.resolve({
            leagueId,
            teamId,
            slots: [],
            inactives: [],
            lastUpdatedAt: null,
            lastUpdatedBy: null,
          });
        },
      }),
      coachesService: createMockCoachesService(),
      log: createTestLogger(),
    });
    const result = await service.getDepthChart("lg-1", "tm-1");
    assertEquals(called, true);
    assertEquals(result.slots, []);
  });

  await t.step("getStatistics passes seasonId through", async () => {
    let receivedSeason: string | null | undefined;
    const service = createRosterService({
      repo: createMockRepo({
        getStatistics: (leagueId, teamId, seasonId) => {
          receivedSeason = seasonId;
          return Promise.resolve({
            leagueId,
            teamId,
            seasonId,
            rows: [],
          });
        },
      }),
      coachesService: createMockCoachesService(),
      log: createTestLogger(),
    });
    await service.getStatistics("lg-1", "tm-1", "season-42");
    assertEquals(receivedSeason, "season-42");

    await service.getStatistics("lg-1", "tm-1", null);
    assertEquals(receivedSeason, null);
  });

  await t.step(
    "getRosterFits returns a SchemeFitLabel for every active player",
    async () => {
      const service = createRosterService({
        repo: createMockRepo({
          getActivePlayersForFit: () =>
            Promise.resolve([
              {
                playerId: "cb-man",
                neutralBucket: "CB",
                attributes: attributes({
                  manCoverage: 95,
                  speed: 95,
                  agility: 90,
                  strength: 80,
                  jumping: 85,
                }),
              },
              {
                playerId: "k",
                neutralBucket: "K",
                attributes: attributes(),
              },
            ]),
        }),
        coachesService: createMockCoachesService({
          getFingerprint: () =>
            Promise.resolve({
              offense: null,
              defense: {
                frontOddEven: 50,
                gapResponsibility: 50,
                subPackageLean: 50,
                coverageManZone: 5,
                coverageShell: 50,
                cornerPressOff: 5,
                pressureRate: 50,
                disguiseRate: 50,
              },
              overrides: {},
            }),
        }),
        log: createTestLogger(),
      });

      const fits = await service.getRosterFits("lg-1", "tm-1");
      assertEquals(Object.keys(fits).length, 2);
      // Man-coverage CB in a press-man scheme: ideal or fits.
      assertEquals(
        fits["cb-man"] === "ideal" || fits["cb-man"] === "fits",
        true,
      );
      // Specialist with no demands maps to neutral.
      assertEquals(fits["k"], "neutral");
    },
  );
});
