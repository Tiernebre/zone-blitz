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
import { createPersonnelService } from "./personnel/mod.ts";
import { createDepthChartPublisher } from "./depth-chart/mod.ts";
import {
  createPlayersRepository,
  createPlayersRouter,
  createPlayersService,
  createStubPlayersGenerator,
} from "./players/mod.ts";
import {
  createCoachesRepository,
  createCoachesRouter,
  createCoachesService,
  createCoachTendenciesRepository,
  createStubCoachesGenerator,
} from "./coaches/mod.ts";
import {
  createRosterRepository,
  createRosterRouter,
  createRosterService,
} from "./roster/mod.ts";
import {
  createScoutsRepository,
  createScoutsRouter,
  createScoutsService,
  createStubScoutsGenerator,
} from "./scouts/mod.ts";
import {
  createFrontOfficeService,
  createStubFrontOfficeGenerator,
} from "./front-office/mod.ts";
import {
  createScheduleService,
  createStubScheduleGenerator,
} from "./schedule/mod.ts";
import { createTransactionRunner } from "../db/transaction-runner.ts";

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
  const coachesRepo = createCoachesRepository({ db, log });
  const coachTendenciesRepo = createCoachTendenciesRepository({ db, log });
  const rosterRepo = createRosterRepository({ db, log });
  const scoutsRepo = createScoutsRepository({ db, log });
  const playersRepo = createPlayersRepository({ db, log });

  // Services
  const userService = createUserService({ userRepo, log });
  const teamService = createTeamService({ teamRepo, log });
  const seasonService = createSeasonService({ seasonRepo, log });
  const playersService = createPlayersService({
    generator: createStubPlayersGenerator(),
    repo: playersRepo,
    db,
    log,
  });
  const coachesService = createCoachesService({
    generator: createStubCoachesGenerator(),
    repo: coachesRepo,
    tendenciesRepo: coachTendenciesRepo,
    db,
    log,
  });
  const scoutsService = createScoutsService({
    generator: createStubScoutsGenerator(),
    repo: scoutsRepo,
    db,
    log,
  });
  const frontOfficeService = createFrontOfficeService({
    generator: createStubFrontOfficeGenerator(),
    db,
    log,
  });
  const depthChartPublisher = createDepthChartPublisher({ db, log });
  const personnelService = createPersonnelService({
    playersService,
    coachesService,
    scoutsService,
    frontOfficeService,
    depthChartPublisher,
    log,
  });
  const scheduleService = createScheduleService({
    generator: createStubScheduleGenerator(),
    db,
    log,
  });
  const txRunner = createTransactionRunner(db);
  const leagueService = createLeagueService({
    txRunner,
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
  const coachesRouter = createCoachesRouter(coachesService);
  const scoutsRouter = createScoutsRouter(scoutsService);
  const rosterService = createRosterService({ repo: rosterRepo, log });
  const rosterRouter = createRosterRouter(rosterService);
  const playersRouter = createPlayersRouter(playersService);

  return {
    auth,
    authRouter,
    healthRouter,
    leagueRouter,
    userRouter,
    teamRouter,
    coachesRouter,
    scoutsRouter,
    rosterRouter,
    playersRouter,
  };
}
