import { assertEquals } from "@std/assert";
import type { ActiveRoster, DepthChart } from "@zone-blitz/shared";
import { createRosterRouter } from "./roster.router.ts";
import type { RosterService } from "./roster.service.interface.ts";

function createMockService(
  overrides: Partial<RosterService> = {},
): RosterService {
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
  return {
    getActiveRoster: () => Promise.resolve(emptyActive),
    getDepthChart: () => Promise.resolve(emptyChart),
    getRosterFits: () => Promise.resolve({}),
    getStatistics: () =>
      Promise.resolve({
        leagueId: "l",
        teamId: "t",
        seasonId: null,
        rows: [],
      }),
    ...overrides,
  };
}

Deno.test("roster.router", async (t) => {
  await t.step(
    "GET /leagues/:leagueId/teams/:teamId/active returns the active roster",
    async () => {
      let receivedLeague: string | undefined;
      let receivedTeam: string | undefined;
      const router = createRosterRouter(
        createMockService({
          getActiveRoster: (leagueId, teamId) => {
            receivedLeague = leagueId;
            receivedTeam = teamId;
            return Promise.resolve({
              leagueId,
              teamId,
              players: [
                {
                  id: "p1",
                  firstName: "Sam",
                  lastName: "Stone",
                  neutralBucket: "QB",
                  neutralBucketGroup: "offense",
                  age: 25,
                  capHit: 10_000_000,
                  contractYearsRemaining: 3,
                  injuryStatus: "healthy",
                },
              ],
              positionGroups: [
                { group: "offense", headcount: 1, totalCap: 10_000_000 },
                { group: "defense", headcount: 0, totalCap: 0 },
                { group: "special_teams", headcount: 0, totalCap: 0 },
              ],
              totalCap: 10_000_000,
              salaryCap: 255_000_000,
              capSpace: 245_000_000,
            });
          },
        }),
      );

      const res = await router.request("/leagues/lg-1/teams/tm-1/active");
      assertEquals(res.status, 200);
      assertEquals(receivedLeague, "lg-1");
      assertEquals(receivedTeam, "tm-1");

      const body = await res.json();
      assertEquals(body.players.length, 1);
      assertEquals(body.players[0].id, "p1");
      assertEquals(body.totalCap, 10_000_000);
    },
  );

  await t.step(
    "GET /leagues/:leagueId/teams/:teamId/depth-chart returns slots + inactives",
    async () => {
      const router = createRosterRouter(
        createMockService({
          getDepthChart: (leagueId, teamId) =>
            Promise.resolve({
              leagueId,
              teamId,
              slots: [
                {
                  playerId: "p1",
                  firstName: "Sam",
                  lastName: "Stone",
                  slotCode: "QB",
                  slotOrdinal: 1,
                  injuryStatus: "healthy",
                },
              ],
              inactives: [],
              lastUpdatedAt: "2026-04-13T00:00:00.000Z",
              lastUpdatedBy: {
                id: "c1",
                firstName: "Alex",
                lastName: "Stone",
                role: "HC",
              },
            }),
        }),
      );
      const res = await router.request("/leagues/lg-1/teams/tm-1/depth-chart");
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.slots.length, 1);
      assertEquals(body.lastUpdatedBy.role, "HC");
    },
  );

  await t.step(
    "GET /leagues/:leagueId/teams/:teamId/statistics passes season query",
    async () => {
      let receivedSeason: string | null | undefined;
      const router = createRosterRouter(
        createMockService({
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
      );
      const res = await router.request(
        "/leagues/lg-1/teams/tm-1/statistics?season=s-42",
      );
      assertEquals(res.status, 200);
      assertEquals(receivedSeason, "s-42");

      await router.request("/leagues/lg-1/teams/tm-1/statistics");
      assertEquals(receivedSeason, null);
    },
  );

  await t.step(
    "GET /leagues/:leagueId/teams/:teamId/fit returns the fit map",
    async () => {
      let receivedLeague: string | undefined;
      let receivedTeam: string | undefined;
      const router = createRosterRouter(
        createMockService({
          getRosterFits: (leagueId, teamId) => {
            receivedLeague = leagueId;
            receivedTeam = teamId;
            return Promise.resolve({ "p-1": "fits", "p-2": "neutral" });
          },
        }),
      );
      const res = await router.request("/leagues/lg-1/teams/tm-1/fit");
      assertEquals(res.status, 200);
      assertEquals(receivedLeague, "lg-1");
      assertEquals(receivedTeam, "tm-1");
      const body = await res.json();
      assertEquals(body["p-1"], "fits");
      assertEquals(body["p-2"], "neutral");
    },
  );
});
