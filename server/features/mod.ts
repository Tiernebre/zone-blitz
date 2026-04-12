import type { Database } from "../db/connection.ts";
import type pino from "pino";
import {
  createLeagueRepository,
  createLeagueRouter,
  createLeagueService,
} from "./league/mod.ts";

export function createFeatureRouters(deps: { db: Database; log: pino.Logger }) {
  const { db, log } = deps;

  // Repositories
  const leagueRepo = createLeagueRepository({ db, log });

  // Services
  const leagueService = createLeagueService({ leagueRepo, log });

  // Routers
  const leagueRouter = createLeagueRouter(leagueService);

  return { leagueRouter };
}
