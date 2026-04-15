import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { castAdvanceVoteSchema } from "@zone-blitz/shared";
import type { LeagueClockService } from "./league-clock.service.ts";
import type { AppEnv } from "../../env.ts";

export function createLeagueClockRouter(service: LeagueClockService) {
  return new Hono<AppEnv>()
    .post(
      "/:leagueId/votes",
      zValidator("json", castAdvanceVoteSchema),
      async (c) => {
        const { teamId } = c.req.valid("json");
        const result = await service.castVote(
          c.req.param("leagueId"),
          teamId,
        );
        return c.json(result, 201);
      },
    );
}
