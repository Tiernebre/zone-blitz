import { Hono } from "hono";
import type { ScoutsService } from "./scouts.service.interface.ts";
import type { AppEnv } from "../../env.ts";

export function createScoutsRouter(scoutsService: ScoutsService) {
  return new Hono<AppEnv>()
    .get("/leagues/:leagueId/teams/:teamId/staff", async (c) => {
      const leagueId = c.req.param("leagueId");
      const teamId = c.req.param("teamId");
      const staff = await scoutsService.getStaffTree(leagueId, teamId);
      return c.json(staff);
    })
    .get("/:scoutId", async (c) => {
      const scoutId = c.req.param("scoutId");
      const detail = await scoutsService.getScoutDetail(scoutId);
      return c.json(detail);
    });
}
