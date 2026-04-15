import { Hono } from "hono";
import type { LeagueClockService } from "./league-clock.service.ts";
import type { AppEnv } from "../../env.ts";

export function createLeagueClockRouter(
  leagueClockService: LeagueClockService,
) {
  return new Hono<AppEnv>()
    .get("/:leagueId", async (c) => {
      const leagueId = c.req.param("leagueId");
      const state = await leagueClockService.getClockState(leagueId);
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

      const result = await leagueClockService.advance(
        leagueId,
        actor,
        body.gateState,
      );

      return c.json(result);
    });
}
