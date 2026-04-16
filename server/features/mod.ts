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
  createPlayersGenerator,
  createPlayersRepository,
  createPlayersRouter,
  createPlayersService,
} from "./players/mod.ts";
import {
  createCoachesGenerator,
  createCoachesRepository,
  createCoachesRouter,
  createCoachesService,
  createCoachTendenciesRepository,
} from "./coaches/mod.ts";
import {
  createRosterRepository,
  createRosterRouter,
  createRosterService,
} from "./roster/mod.ts";
import {
  createScoutsGenerator,
  createScoutsRepository,
  createScoutsRouter,
  createScoutsService,
} from "./scouts/mod.ts";
import {
  createFrontOfficeGenerator,
  createFrontOfficeService,
} from "./front-office/mod.ts";
import {
  createScheduleGenerator,
  createScheduleService,
} from "./schedule/mod.ts";
import {
  createLeagueClockRepository,
  createLeagueClockRouter,
  createLeagueClockService,
} from "./league-clock/mod.ts";
import {
  createFranchiseRepository,
  createFranchiseRouter,
  createFranchiseService,
} from "./franchise/mod.ts";
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
    generator: createPlayersGenerator(),
    repo: playersRepo,
    db,
    log,
  });
  const coachesService = createCoachesService({
    generator: createCoachesGenerator(),
    repo: coachesRepo,
    tendenciesRepo: coachTendenciesRepo,
    db,
    log,
  });
  const scoutsService = createScoutsService({
    generator: createScoutsGenerator(),
    repo: scoutsRepo,
    db,
    log,
  });
  const frontOfficeService = createFrontOfficeService({
    generator: createFrontOfficeGenerator(),
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
    generator: createScheduleGenerator(),
    db,
    log,
  });
  const txRunner = createTransactionRunner(db);

  // League Clock + Franchise repos (needed by league service)
  const leagueClockRepo = createLeagueClockRepository({ db, log });
  const franchiseRepo = createFranchiseRepository({ db, log });
  const franchiseService = createFranchiseService({ franchiseRepo, log });

  const leagueService = createLeagueService({
    txRunner,
    leagueRepo,
    seasonService,
    teamService,
    franchiseService,
    personnelService,
    scheduleService,
    leagueClockRepo,
    log,
  });

  // League Clock service
  const leagueClockService = createLeagueClockService({
    txRunner,
    leagueClockRepo,
    log,
  });
  const leagueClockRouter = createLeagueClockRouter(leagueClockService);

  // Routers
  const leagueRouter = createLeagueRouter(leagueService);
  const userRouter = createUserRouter(userService);
  const teamRouter = createTeamRouter(teamService);
  const franchiseRouter = createFranchiseRouter(franchiseService);
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
    leagueClockRouter,
    userRouter,
    teamRouter,
    franchiseRouter,
    coachesRouter,
    scoutsRouter,
    rosterRouter,
    playersRouter,
  };
}
