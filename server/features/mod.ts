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
import {
  createTeamRepository,
  createTeamRouter,
  createTeamService,
} from "./team/mod.ts";
import { createSeasonRepository } from "./season/mod.ts";
import { createStubPersonnelGenerator } from "./personnel/mod.ts";
import { createStubScheduleGenerator } from "./schedule/mod.ts";

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
  const teamRepo = createTeamRepository({ db, log });
  const seasonRepo = createSeasonRepository({ db, log });

  // Generators
  const personnelGenerator = createStubPersonnelGenerator();
  const scheduleGenerator = createStubScheduleGenerator();

  // Services
  const leagueService = createLeagueService({
    leagueRepo,
    seasonRepo,
    teamRepo,
    personnelGenerator,
    scheduleGenerator,
    db,
    log,
  });
  const userService = createUserService({ userRepo, log });
  const teamService = createTeamService({ teamRepo, log });

  // Routers
  const leagueRouter = createLeagueRouter(leagueService);
  const userRouter = createUserRouter(userService);
  const teamRouter = createTeamRouter(teamService);

  return {
    auth,
    authRouter,
    healthRouter,
    leagueRouter,
    userRouter,
    teamRouter,
  };
}
