import { assertEquals } from "@std/assert";
import type {
  ActiveRoster,
  DepthChart,
  RosterStatistics,
} from "@zone-blitz/shared";
import { createRosterService } from "./roster.service.ts";
import type { RosterRepository } from "./roster.repository.interface.ts";

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
    ...overrides,
  };
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
      log: createTestLogger(),
    });
    await service.getStatistics("lg-1", "tm-1", "season-42");
    assertEquals(receivedSeason, "season-42");

    await service.getStatistics("lg-1", "tm-1", null);
    assertEquals(receivedSeason, null);
  });
});
