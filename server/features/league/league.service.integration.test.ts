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
import { createSeasonRepository } from "../season/season.repository.ts";
import { createSeasonService } from "../season/season.service.ts";
import type { PersonnelService } from "../personnel/personnel.service.interface.ts";
import type { ScheduleService } from "../schedule/schedule.service.interface.ts";
import type { TeamService } from "../team/team.service.interface.ts";

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

    const seasonService = createSeasonService({ seasonRepo, log });

    // Synthetic team so the test is seed-independent. We only need
    // teamService.getAll() to return a non-empty array — the league service
    // passes these ids downstream, but our personnel/schedule stubs don't
    // touch the database, so no FK against the real teams table is required.
    const teamService: TeamService = {
      getAll: () =>
        Promise.resolve([
          {
            id: crypto.randomUUID(),
            name: "Stub Team",
            cityId: crypto.randomUUID(),
            city: "Stubville",
            state: "NY",
            abbreviation: "STB",
            primaryColor: "#000",
            secondaryColor: "#FFF",
            accentColor: "#F00",
            conference: "AFC",
            division: "AFC East",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      getById: () => Promise.reject(new Error("not used")),
    };

    // Personnel is a no-op: rollback is proven by observing the real league
    // and season writes (which go through the real repositories and enlist
    // in the root transaction) disappear after the failure. That is
    // sufficient evidence the tx boundary works — Postgres rolls back every
    // enlisted write or none.
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
    } finally {
      await db.delete(leagues).where(eq(leagues.name, leagueName));
      await client.end();
    }
  },
});
