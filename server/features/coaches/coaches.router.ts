import { Hono } from "hono";
import type { CoachesService } from "./coaches.service.interface.ts";
import type { AppEnv } from "../../env.ts";

export function createCoachesRouter(coachesService: CoachesService) {
  return new Hono<AppEnv>()
    .get("/leagues/:leagueId/teams/:teamId/staff", async (c) => {
      const leagueId = c.req.param("leagueId");
      const teamId = c.req.param("teamId");
      const staff = await coachesService.getStaffTree(leagueId, teamId);
      return c.json(staff);
    })
    .get("/:coachId", async (c) => {
      const coachId = c.req.param("coachId");
      const detail = await coachesService.getCoachDetail(coachId);
      return c.json(detail);
    });
}
