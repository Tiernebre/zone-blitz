import { sql } from "drizzle-orm";
import type { Database } from "../db/connection.ts";
import type pino from "pino";
import { createHealthRouter, createHealthService } from "./health/mod.ts";
import {
  createLeagueRepository,
  createLeagueRouter,
  createLeagueService,
} from "./league/mod.ts";

export function createFeatureRouters(
  deps: { db: Database; commit: string; log: pino.Logger },
) {
  const { db, commit, log } = deps;

  // Health
  const healthService = createHealthService({
    ping: async () => {
      await db.execute(sql`SELECT 1`);
    },
    commit,
    log,
  });
  const healthRouter = createHealthRouter(healthService);

  // Repositories
  const leagueRepo = createLeagueRepository({ db, log });

  // Services
  const leagueService = createLeagueService({ leagueRepo, log });

  // Routers
  const leagueRouter = createLeagueRouter(leagueService);

  return { healthRouter, leagueRouter };
}
