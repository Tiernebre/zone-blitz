import { Hono } from "hono";
import type { AppEnv } from "../../env.ts";
import type { PlayersService } from "./players.service.interface.ts";

export function createPlayersRouter(playersService: PlayersService) {
  return new Hono<AppEnv>()
    .get("/:playerId", async (c) => {
      const playerId = c.req.param("playerId");
      const detail = await playersService.getDetail(playerId);
      return c.json(detail);
    });
}
