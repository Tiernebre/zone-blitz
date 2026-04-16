import { assertEquals } from "@std/assert";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, inArray } from "drizzle-orm";
import pino from "pino";
import * as schema from "../../db/schema.ts";
import { leagues } from "./league.schema.ts";
import { seasons } from "../season/season.schema.ts";
import { teams } from "../team/team.schema.ts";
import { franchises } from "../franchise/franchise.schema.ts";
import { cities } from "../cities/city.schema.ts";
import { states } from "../states/state.schema.ts";
import { createLeagueRepository } from "./league.repository.ts";
import { createLeagueService } from "./league.service.ts";
import { createTransactionRunner } from "../../db/transaction-runner.ts";
import { createSeasonRepository } from "../season/season.repository.ts";
import { createSeasonService } from "../season/season.service.ts";
import { createTeamRepository } from "../team/team.repository.ts";
import { createTeamService } from "../team/team.service.ts";
import { createFranchiseRepository } from "../franchise/franchise.repository.ts";
import { createFranchiseService } from "../franchise/franchise.service.ts";
import type { PersonnelService } from "../personnel/personnel.service.interface.ts";
import type { ScheduleService } from "../schedule/schedule.service.interface.ts";
import type { LeagueClockRepository } from "../league-clock/league-clock.repository.ts";
import { FOUNDING_FRANCHISES } from "../franchise/founding-franchises.ts";

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

function uniqAbbr(seed: string) {
  return `${seed}${crypto.randomUUID().slice(0, 2).toUpperCase()}`.slice(0, 6);
}

async function seedFoundingFranchises(
  db: ReturnType<typeof createTestDb>["db"],
): Promise<{
  franchiseIds: string[];
  cityIds: string[];
  stateIds: string[];
}> {
  // create() asserts exactly 8 franchises exist globally; wipe seed-loaded
  // franchises (and any teams referencing them) so each test starts from a
  // controlled count.
  await db.delete(teams);
  await db.delete(franchises);

  const franchiseIds: string[] = [];
  const cityIds: string[] = [];
  const stateIds: string[] = [];

  for (const [i, f] of FOUNDING_FRANCHISES.entries()) {
    const [state] = await db
      .insert(states)
      .values({
        code: `IT-${crypto.randomUUID().slice(0, 6)}`,
        name: `IntegrationState-${crypto.randomUUID()}`,
        region: "West",
      })
      .returning();
    stateIds.push(state.id);
    const [city] = await db
      .insert(cities)
      .values({
        name: `${f.city}-${crypto.randomUUID().slice(0, 4)}`,
        stateId: state.id,
      })
      .returning();
    cityIds.push(city.id);
    const [franchise] = await db
      .insert(franchises)
      .values({
        name: f.name,
        cityId: city.id,
        abbreviation: uniqAbbr(`X${i}`),
        primaryColor: f.primaryColor,
        secondaryColor: f.secondaryColor,
        accentColor: f.accentColor,
        backstory: f.backstory,
        conference: f.conference,
        division: f.division,
      })
      .returning();
    franchiseIds.push(franchise.id);
  }

  return { franchiseIds, cityIds, stateIds };
}

async function cleanupFranchises(
  db: ReturnType<typeof createTestDb>["db"],
  ids: { franchiseIds: string[]; cityIds: string[]; stateIds: string[] },
) {
  if (ids.franchiseIds.length > 0) {
    await db
      .delete(franchises)
      .where(inArray(franchises.id, ids.franchiseIds));
  }
  if (ids.cityIds.length > 0) {
    await db.delete(cities).where(inArray(cities.id, ids.cityIds));
  }
  if (ids.stateIds.length > 0) {
    await db.delete(states).where(inArray(states.id, ids.stateIds));
  }
}

Deno.test({
  name: "league.service.create creates league shell and teams in a transaction",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const log = createTestLogger();

    const leagueRepo = createLeagueRepository({ db, log });
    const seasonRepo = createSeasonRepository({ db, log });
    const seasonService = createSeasonService({ seasonRepo, log });
    const teamRepo = createTeamRepository({ db, log });
    const teamService = createTeamService({ teamRepo, log });
    const franchiseRepo = createFranchiseRepository({ db, log });
    const franchiseService = createFranchiseService({ franchiseRepo, log });

    const leagueName = `Shell Test ${crypto.randomUUID()}`;
    const seedIds = await seedFoundingFranchises(db);

    const service = createLeagueService({
      txRunner: createTransactionRunner(db),
      leagueRepo,
      seasonService,
      teamService,
      franchiseService,
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
      leagueClockRepo: createStubLeagueClockRepo(),
      log,
    });

    let createdLeagueId: string | undefined;

    try {
      const result = await service.create({ name: leagueName });
      createdLeagueId = result.league.id;
      assertEquals(result.league.name, leagueName);
      assertEquals(result.teams.length, FOUNDING_TEAM_COUNT);

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
      if (createdLeagueId) {
        await db.delete(teams).where(eq(teams.leagueId, createdLeagueId));
      }
      await db.delete(leagues).where(eq(leagues.name, leagueName));
      await cleanupFranchises(db, seedIds);
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
    const teamRepo = createTeamRepository({ db, log });
    const teamService = createTeamService({ teamRepo, log });
    const franchiseRepo = createFranchiseRepository({ db, log });
    const franchiseService = createFranchiseService({ franchiseRepo, log });

    const leagueName = `Rollback Test ${crypto.randomUUID()}`;
    const seedIds = await seedFoundingFranchises(db);

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
      teamService,
      franchiseService,
      personnelService,
      scheduleService: throwingSchedule,
      leagueClockRepo: createStubLeagueClockRepo(),
      log,
    });

    let createdLeagueId: string | undefined;

    try {
      const shellResult = await service.create({ name: leagueName });
      createdLeagueId = shellResult.league.id;

      let caught: unknown;
      try {
        await service.found(createdLeagueId);
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
        .where(eq(seasons.leagueId, createdLeagueId));
      assertEquals(seasonRows.length, 0, "season should be rolled back");
    } finally {
      if (createdLeagueId) {
        await db.delete(teams).where(eq(teams.leagueId, createdLeagueId));
      }
      await db.delete(leagues).where(eq(leagues.name, leagueName));
      await cleanupFranchises(db, seedIds);
      await client.end();
    }
  },
});
