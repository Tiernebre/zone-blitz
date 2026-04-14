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
import { createSeasonRepository, createSeasonService } from "./season/mod.ts";
import {
  createPersonnelService,
  createStubPersonnelGenerator,
} from "./personnel/mod.ts";
import {
  createPlayersService,
  createStubPlayersGenerator,
} from "./players/mod.ts";
import {
  createScheduleService,
  createStubScheduleGenerator,
} from "./schedule/mod.ts";

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

  // Services
  const userService = createUserService({ userRepo, log });
  const teamService = createTeamService({ teamRepo, log });
  const seasonService = createSeasonService({ seasonRepo, log });
  const playersService = createPlayersService({
    generator: createStubPlayersGenerator(),
    db,
    log,
  });
  const personnelService = createPersonnelService({
    generator: createStubPersonnelGenerator(),
    playersService,
    db,
    log,
  });
  const scheduleService = createScheduleService({
    generator: createStubScheduleGenerator(),
    db,
    log,
  });
  const leagueService = createLeagueService({
    leagueRepo,
    seasonService,
    teamService,
    personnelService,
    scheduleService,
    log,
  });

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
