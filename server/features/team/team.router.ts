import { Hono } from "hono";
import type { TeamRepository } from "./team.repository.interface.ts";
import type { AppEnv } from "../../env.ts";

export function createTeamRouter(teamRepo: TeamRepository) {
  return new Hono<AppEnv>()
    .get("/", async (c) => {
      const teams = await teamRepo.getAll();
      return c.json(teams);
    });
}
