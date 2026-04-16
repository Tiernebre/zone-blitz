import { Hono } from "hono";
import type { TeamService } from "./team.service.interface.ts";
import type { AppEnv } from "../../env.ts";

export function createTeamRouter(teamService: TeamService) {
  return new Hono<AppEnv>()
    .get("/league/:leagueId", async (c) => {
      const leagueId = c.req.param("leagueId");
      const teams = await teamService.getByLeagueId(leagueId);
      return c.json(teams);
    })
    .get("/:id", async (c) => {
      const id = c.req.param("id");
      const team = await teamService.getById(id);
      return c.json(team);
    });
}
