import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { castAdvanceVoteSchema } from "@zone-blitz/shared";
import type { LeagueClockService } from "./league-clock.service.ts";
import type { AppEnv } from "../../env.ts";

export function createLeagueClockRouter(service: LeagueClockService) {
  return new Hono<AppEnv>()
    .get("/:leagueId", async (c) => {
      const leagueId = c.req.param("leagueId");
      const state = await service.getClockState(leagueId);
      return c.json(state);
    })
    .post("/:leagueId/advance", async (c) => {
      const leagueId = c.req.param("leagueId");
      const user = c.get("user");
      const body = await c.req.json();

      const actor = {
        userId: user?.id ?? "",
        isCommissioner: body.isCommissioner ?? false,
        overrideReason: body.overrideReason,
      };

      const result = await service.advance(
        leagueId,
        actor,
        body.gateState,
      );

      return c.json(result);
    })
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
