import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { LeagueService } from "@zone-blitz/shared";
import { createLeagueSchema } from "@zone-blitz/shared";
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
      const league = await leagueService.create(input);
      return c.json(league, 201);
    });
}
