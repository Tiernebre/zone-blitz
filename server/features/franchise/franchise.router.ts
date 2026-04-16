import { Hono } from "hono";
import type { FranchiseService } from "./franchise.service.interface.ts";
import type { AppEnv } from "../../env.ts";

export function createFranchiseRouter(franchiseService: FranchiseService) {
  return new Hono<AppEnv>()
    .get("/", async (c) => {
      const franchises = await franchiseService.getAll();
      return c.json(franchises);
    });
}
