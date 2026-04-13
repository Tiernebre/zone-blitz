import { sql } from "drizzle-orm";
import type { Database } from "../db/connection.ts";
import type pino from "pino";
import { createHealthRouter, createHealthService } from "./health/mod.ts";
import { createAuth, createAuthRouter } from "./auth/mod.ts";
import {
  createLeagueRepository,
  createLeagueRouter,
  createLeagueService,
} from "./league/mod.ts";
import {
  createUserRepository,
  createUserRouter,
  createUserService,
} from "./user/mod.ts";

export function createFeatureRouters(
  deps: {
    db: Database;
    commit: string;
    log: pino.Logger;
    googleClientId: string;
    googleClientSecret: string;
  },
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

  // Auth
  const auth = createAuth({
    db,
    googleClientId: deps.googleClientId,
    googleClientSecret: deps.googleClientSecret,
  });
  const authRouter = createAuthRouter(auth);

  // Repositories
  const leagueRepo = createLeagueRepository({ db, log });
  const userRepo = createUserRepository({ db, log });

  // Services
  const leagueService = createLeagueService({ leagueRepo, log });
  const userService = createUserService({ userRepo, log });

  // Routers
  const leagueRouter = createLeagueRouter(leagueService);
  const userRouter = createUserRouter(userService);

  return { auth, authRouter, healthRouter, leagueRouter, userRouter };
}
