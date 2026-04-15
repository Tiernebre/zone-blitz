import { assertEquals } from "@std/assert";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import pino from "pino";
import * as schema from "../../db/schema.ts";
import { leagues } from "./league.schema.ts";
import { seasons } from "../season/season.schema.ts";
import { createLeagueRepository } from "./league.repository.ts";
import { createLeagueService } from "./league.service.ts";
import { createTransactionRunner } from "../../db/transaction-runner.ts";
import { createSeasonRepository } from "../season/season.repository.ts";
import { createSeasonService } from "../season/season.service.ts";
import type { PersonnelService } from "../personnel/personnel.service.interface.ts";
import type { ScheduleService } from "../schedule/schedule.service.interface.ts";
import type { TeamService } from "../team/team.service.interface.ts";
import type { FranchiseRepository } from "../franchise/franchise.repository.ts";
import type { LeagueClockRepository } from "../league-clock/league-clock.repository.ts";

const FOUNDING_TEAM_COUNT = 8;

function createTestDb() {
  const connectionString = Deno.env.get("DATABASE_URL");
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for integration tests");
  }
  const client = postgres(connectionString);
  const db = drizzle(client, { schema });
  return { db, client };
}

function createTestLogger() {
  return pino({ level: "silent" });
}

function createStubTeamService(): TeamService {
  const teams = Array.from({ length: FOUNDING_TEAM_COUNT }, (_, i) => ({
    id: crypto.randomUUID(),
    name: `Stub Team ${i + 1}`,
    cityId: crypto.randomUUID(),
    city: "Stubville",
    state: "NY",
    abbreviation: `ST${i}`,
    primaryColor: "#000",
    secondaryColor: "#FFF",
    accentColor: "#F00",
    conference: i < 4 ? "AFC" : "NFC",
    division: i < 4 ? "AFC East" : "NFC East",
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  return {
    getAll: () => Promise.resolve(teams),
    getById: () => Promise.reject(new Error("not used")),
  };
}

function createStubFranchiseRepo(): FranchiseRepository {
  return {
    createMany: (rows) =>
      Promise.resolve(
        rows.map((r) => ({
          id: crypto.randomUUID(),
          leagueId: r.leagueId,
          teamId: r.teamId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      ),
    getByLeagueId: () => Promise.resolve([]),
  };
}

function createStubLeagueClockRepo(): LeagueClockRepository {
  return {
    getByLeagueId: () => Promise.resolve(undefined),
    upsert: (row) =>
      Promise.resolve({
        leagueId: row.leagueId,
        seasonYear: row.seasonYear,
        phase: row.phase,
        stepIndex: row.stepIndex,
        advancedAt: new Date(),
        advancedByUserId: row.advancedByUserId,
        overrideReason: row.overrideReason ?? null,
        overrideBlockers: row.overrideBlockers ?? null,
        hasCompletedGenesis: row.hasCompletedGenesis ?? false,
      }),
    castVote: () => Promise.reject(new Error("not used")),
    getVotesForStep: () => Promise.resolve([]),
  };
}

Deno.test({
  name:
    "league.service.create creates league shell and franchises in a transaction",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const log = createTestLogger();

    const leagueRepo = createLeagueRepository({ db, log });
    const seasonRepo = createSeasonRepository({ db, log });
    const seasonService = createSeasonService({ seasonRepo, log });

    const leagueName = `Shell Test ${crypto.randomUUID()}`;
    const service = createLeagueService({
      txRunner: createTransactionRunner(db),
      leagueRepo,
      seasonService,
      teamService: createStubTeamService(),
      personnelService: {
        generate: () =>
          Promise.resolve({
            playerCount: 0,
            coachCount: 0,
            scoutCount: 0,
            frontOfficeCount: 0,
            draftProspectCount: 0,
            contractCount: 0,
          }),
      },
      scheduleService: {
        generate: () => Promise.resolve({ gameCount: 0 }),
      },
      franchiseRepo: createStubFranchiseRepo(),
      leagueClockRepo: createStubLeagueClockRepo(),
      log,
    });

    try {
      const result = await service.create({ name: leagueName });
      assertEquals(result.league.name, leagueName);
      assertEquals(result.franchises.length, FOUNDING_TEAM_COUNT);

      const leagueRows = await db.select().from(leagues).where(
        eq(leagues.name, leagueName),
      );
      assertEquals(leagueRows.length, 1);

      const seasonRows = await db
        .select()
        .from(seasons)
        .where(eq(seasons.leagueId, result.league.id));
      assertEquals(
        seasonRows.length,
        0,
        "no season should be created during shell creation",
      );
    } finally {
      await db.delete(leagues).where(eq(leagues.name, leagueName));
      await client.end();
    }
  },
});

Deno.test({
  name:
    "league.service.found rolls back all writes when a downstream service throws",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const log = createTestLogger();

    const leagueRepo = createLeagueRepository({ db, log });
    const seasonRepo = createSeasonRepository({ db, log });
    const seasonService = createSeasonService({ seasonRepo, log });

    const leagueName = `Rollback Test ${crypto.randomUUID()}`;

    const stubFranchises = Array.from(
      { length: FOUNDING_TEAM_COUNT },
      () => ({
        id: crypto.randomUUID(),
        leagueId: "will-be-replaced",
        teamId: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const throwingSchedule: ScheduleService = {
      generate: () => Promise.reject(new Error("synthetic schedule failure")),
    };

    const personnelService: PersonnelService = {
      generate: () =>
        Promise.resolve({
          playerCount: 0,
          coachCount: 0,
          scoutCount: 0,
          frontOfficeCount: 0,
          draftProspectCount: 0,
          contractCount: 0,
        }),
    };

    const service = createLeagueService({
      txRunner: createTransactionRunner(db),
      leagueRepo,
      seasonService,
      teamService: createStubTeamService(),
      personnelService,
      scheduleService: throwingSchedule,
      franchiseRepo: createStubFranchiseRepo(),
      leagueClockRepo: createStubLeagueClockRepo(),
      log,
    });

    try {
      const shellResult = await service.create({ name: leagueName });
      const leagueId = shellResult.league.id;

      const franchiseRepoWithData: FranchiseRepository = {
        ...createStubFranchiseRepo(),
        getByLeagueId: () =>
          Promise.resolve(
            stubFranchises.map((f) => ({ ...f, leagueId })),
          ),
      };

      const foundService = createLeagueService({
        txRunner: createTransactionRunner(db),
        leagueRepo,
        seasonService,
        teamService: createStubTeamService(),
        personnelService,
        scheduleService: throwingSchedule,
        franchiseRepo: franchiseRepoWithData,
        leagueClockRepo: createStubLeagueClockRepo(),
        log,
      });

      let caught: unknown;
      try {
        await foundService.found(leagueId);
      } catch (err) {
        caught = err;
      }
      assertEquals(
        (caught as Error)?.message,
        "synthetic schedule failure",
        "the injected schedule failure must propagate out",
      );

      const seasonRows = await db
        .select()
        .from(seasons)
        .where(eq(seasons.leagueId, leagueId));
      assertEquals(seasonRows.length, 0, "season should be rolled back");
    } finally {
      await db.delete(leagues).where(eq(leagues.name, leagueName));
      await client.end();
    }
  },
});
