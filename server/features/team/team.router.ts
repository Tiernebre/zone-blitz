import { Hono } from "hono";
import type { TeamService } from "./team.service.interface.ts";
import type { AppEnv } from "../../env.ts";

export function createTeamRouter(teamService: TeamService) {
  return new Hono<AppEnv>()
    .get("/", async (c) => {
      const teams = await teamService.getAll();
      return c.json(teams);
    });
}
