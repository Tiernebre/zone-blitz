import { assertEquals } from "@std/assert";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import pino from "pino";
import * as schema from "../../db/schema.ts";
import { leagues } from "./league.schema.ts";
import { seasons } from "../season/season.schema.ts";
import { players } from "../players/player.schema.ts";
import { createLeagueRepository } from "./league.repository.ts";
import { createLeagueService } from "./league.service.ts";
import { createSeasonRepository } from "../season/season.repository.ts";
import { createSeasonService } from "../season/season.service.ts";
import { createTeamRepository } from "../team/team.repository.ts";
import { createTeamService } from "../team/team.service.ts";
import type { PersonnelService } from "../personnel/personnel.service.interface.ts";
import type { ScheduleService } from "../schedule/schedule.service.interface.ts";

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

Deno.test({
  name:
    "league.service.create rolls back all writes when a downstream service throws",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const log = createTestLogger();

    const leagueRepo = createLeagueRepository({ db, log });
    const seasonRepo = createSeasonRepository({ db, log });
    const teamRepo = createTeamRepository({ db, log });

    const seasonService = createSeasonService({ seasonRepo, log });
    const teamService = createTeamService({ teamRepo, log });

    // Lean personnel stand-in: performs a real player insert against the tx
    // so rollback can be observed, but avoids generating the full 53-per-team
    // roster whose bulk insert overflows drizzle's SQL builder. The aim of
    // this test is to prove the root transaction rolls back, not to stress
    // the generators.
    const personnelService: PersonnelService = {
      generate: async (input, tx) => {
        const exec = tx ?? db;
        await exec.insert(players).values({
          leagueId: input.leagueId,
          teamId: input.teamIds[0],
          firstName: "Rollback",
          lastName: "Probe",
          heightInches: 72,
          weightPounds: 220,
          college: null,
          birthDate: "2000-01-01",
        });
        return {
          playerCount: 1,
          coachCount: 0,
          scoutCount: 0,
          frontOfficeCount: 0,
          draftProspectCount: 0,
          contractCount: 0,
        };
      },
    };

    const throwingSchedule: ScheduleService = {
      generate: () => Promise.reject(new Error("synthetic schedule failure")),
    };

    const leagueName = `Rollback Test ${crypto.randomUUID()}`;
    const service = createLeagueService({
      db,
      leagueRepo,
      seasonService,
      teamService,
      personnelService,
      scheduleService: throwingSchedule,
      log,
    });

    try {
      let caught: unknown;
      try {
        await service.create({ name: leagueName });
      } catch (err) {
        caught = err;
      }
      assertEquals(
        (caught as Error)?.message,
        "synthetic schedule failure",
        "the injected schedule failure must propagate out",
      );

      const leagueRows = await db.select().from(leagues).where(
        eq(leagues.name, leagueName),
      );
      assertEquals(leagueRows.length, 0, "league row should be rolled back");

      const seasonRows = await db
        .select()
        .from(seasons)
        .innerJoin(leagues, eq(leagues.id, seasons.leagueId))
        .where(eq(leagues.name, leagueName));
      assertEquals(seasonRows.length, 0, "season should be rolled back");

      const playerRows = await db
        .select()
        .from(players)
        .where(eq(players.firstName, "Rollback"));
      // Only this test inserts a "Rollback" firstName; if rollback worked,
      // there should be no survivor from any prior run either.
      assertEquals(
        playerRows.length,
        0,
        "probe player should be rolled back",
      );
    } finally {
      await db.delete(leagues).where(eq(leagues.name, leagueName));
      await client.end();
    }
  },
});
