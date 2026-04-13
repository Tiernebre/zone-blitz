import { assertEquals } from "@std/assert";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema.ts";
import { seasons } from "./season.schema.ts";
import { leagues } from "../league/league.schema.ts";
import { createSeasonRepository } from "./season.repository.ts";
import pino from "pino";
import { eq } from "drizzle-orm";

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

async function createTestLeague(db: ReturnType<typeof createTestDb>["db"]) {
  const [league] = await db
    .insert(leagues)
    .values({ name: "Test League" })
    .returning();
  return league;
}

Deno.test({
  name: "seasonRepository.getByLeagueId: returns seasons for a league",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createSeasonRepository({ db, log: createTestLogger() });
    let leagueId: string | undefined;

    try {
      const league = await createTestLeague(db);
      leagueId = league.id;

      await db
        .insert(seasons)
        .values([
          { leagueId: league.id, year: 1 },
          { leagueId: league.id, year: 2 },
        ]);

      const result = await repo.getByLeagueId(league.id);
      assertEquals(result.length, 2);

      const years = result.map((s) => s.year);
      assertEquals(years.includes(1), true);
      assertEquals(years.includes(2), true);
    } finally {
      if (leagueId) {
        await db.delete(seasons).where(eq(seasons.leagueId, leagueId));
        await db.delete(leagues).where(eq(leagues.id, leagueId));
      }
      await client.end();
    }
  },
});

Deno.test({
  name: "seasonRepository.getByLeagueId: returns empty array when no seasons",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createSeasonRepository({ db, log: createTestLogger() });

    try {
      const result = await repo.getByLeagueId(crypto.randomUUID());
      assertEquals(result.length, 0);
    } finally {
      await client.end();
    }
  },
});

Deno.test({
  name: "seasonRepository.getById: returns the season when it exists",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createSeasonRepository({ db, log: createTestLogger() });
    let leagueId: string | undefined;

    try {
      const league = await createTestLeague(db);
      leagueId = league.id;

      const [created] = await db
        .insert(seasons)
        .values({ leagueId: league.id, year: 1 })
        .returning();

      const result = await repo.getById(created.id);
      assertEquals(result?.id, created.id);
      assertEquals(result?.year, 1);
      assertEquals(result?.phase, "preseason");
      assertEquals(result?.week, 1);
    } finally {
      if (leagueId) {
        await db.delete(seasons).where(eq(seasons.leagueId, leagueId));
        await db.delete(leagues).where(eq(leagues.id, leagueId));
      }
      await client.end();
    }
  },
});

Deno.test({
  name: "seasonRepository.getById: returns undefined when not found",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createSeasonRepository({ db, log: createTestLogger() });

    try {
      const result = await repo.getById(crypto.randomUUID());
      assertEquals(result, undefined);
    } finally {
      await client.end();
    }
  },
});

Deno.test({
  name:
    "seasonRepository.create: inserts and returns the new season with defaults",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createSeasonRepository({ db, log: createTestLogger() });
    let leagueId: string | undefined;

    try {
      const league = await createTestLeague(db);
      leagueId = league.id;

      const result = await repo.create({ leagueId: league.id });

      assertEquals(result.leagueId, league.id);
      assertEquals(result.year, 1);
      assertEquals(result.phase, "preseason");
      assertEquals(result.week, 1);
      assertEquals(typeof result.id, "string");
    } finally {
      if (leagueId) {
        await db.delete(seasons).where(eq(seasons.leagueId, leagueId));
        await db.delete(leagues).where(eq(leagues.id, leagueId));
      }
      await client.end();
    }
  },
});

Deno.test({
  name: "seasonRepository.create: accepts custom year, phase, and week",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createSeasonRepository({ db, log: createTestLogger() });
    let leagueId: string | undefined;

    try {
      const league = await createTestLeague(db);
      leagueId = league.id;

      const result = await repo.create({
        leagueId: league.id,
        year: 3,
        phase: "regular_season",
        week: 10,
      });

      assertEquals(result.year, 3);
      assertEquals(result.phase, "regular_season");
      assertEquals(result.week, 10);
    } finally {
      if (leagueId) {
        await db.delete(seasons).where(eq(seasons.leagueId, leagueId));
        await db.delete(leagues).where(eq(leagues.id, leagueId));
      }
      await client.end();
    }
  },
});
