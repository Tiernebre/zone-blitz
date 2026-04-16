import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { LeagueService } from "./league.service.interface.ts";
import { assignUserTeamSchema, createLeagueSchema } from "@zone-blitz/shared";
import type { AppEnv } from "../../env.ts";

export function createLeagueRouter(leagueService: LeagueService) {
  return new Hono<AppEnv>()
    .get("/", async (c) => {
      const leagues = await leagueService.getAll();
      return c.json(leagues);
    })
    .get("/:id", async (c) => {
      const league = await leagueService.getById(c.req.param("id"));
      return c.json(league);
    })
    .post("/", zValidator("json", createLeagueSchema), async (c) => {
      const input = c.req.valid("json");
      const result = await leagueService.create(input);
      return c.json(result, 201);
    })
    .get("/:id/teams", async (c) => {
      const teams = await leagueService.getTeams(c.req.param("id"));
      return c.json(teams);
    })
    .post("/:id/found", async (c) => {
      const result = await leagueService.found(c.req.param("id"));
      return c.json(result);
    })
    .patch(
      "/:id/user-team",
      zValidator("json", assignUserTeamSchema),
      async (c) => {
        const { userTeamId } = c.req.valid("json");
        const league = await leagueService.assignUserTeam(
          c.req.param("id"),
          userTeamId,
        );
        return c.json(league);
      },
    )
    .post("/:id/touch", async (c) => {
      const league = await leagueService.touchLastPlayed(c.req.param("id"));
      return c.json(league);
    })
    .delete("/:id", async (c) => {
      await leagueService.deleteById(c.req.param("id"));
      return c.body(null, 204);
    });
}
