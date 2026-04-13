import { Hono } from "hono";
import type { HealthService } from "./health.service.interface.ts";
import type { AppEnv } from "../../env.ts";

export function createHealthRouter(healthService: HealthService) {
  return new Hono<AppEnv>()
    .get("/", async (c) => {
      const result = await healthService.check();
      const status = result.status === "ok" ? 200 : 500;
      return c.json(result, status);
    });
}
