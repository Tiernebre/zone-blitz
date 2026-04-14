import { Hono } from "hono";
import type { RosterService } from "./roster.service.interface.ts";
import type { AppEnv } from "../../env.ts";

export function createRosterRouter(rosterService: RosterService) {
  return new Hono<AppEnv>()
    .get("/leagues/:leagueId/teams/:teamId/active", async (c) => {
      const leagueId = c.req.param("leagueId");
      const teamId = c.req.param("teamId");
      const roster = await rosterService.getActiveRoster(leagueId, teamId);
      return c.json(roster);
    })
    .get("/leagues/:leagueId/teams/:teamId/depth-chart", async (c) => {
      const leagueId = c.req.param("leagueId");
      const teamId = c.req.param("teamId");
      const chart = await rosterService.getDepthChart(leagueId, teamId);
      return c.json(chart);
    })
    .get("/leagues/:leagueId/teams/:teamId/fit", async (c) => {
      const leagueId = c.req.param("leagueId");
      const teamId = c.req.param("teamId");
      const fits = await rosterService.getRosterFits(leagueId, teamId);
      return c.json(fits);
    })
    .get("/leagues/:leagueId/teams/:teamId/statistics", async (c) => {
      const leagueId = c.req.param("leagueId");
      const teamId = c.req.param("teamId");
      const seasonId = c.req.query("season") ?? null;
      const stats = await rosterService.getStatistics(
        leagueId,
        teamId,
        seasonId,
      );
      return c.json(stats);
    });
}
