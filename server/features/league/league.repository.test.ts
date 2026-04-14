import { assertEquals } from "@std/assert";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema.ts";
import { leagues } from "./league.schema.ts";
import { createLeagueRepository } from "./league.repository.ts";
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

Deno.test({
  name: "leagueRepository.getAll: returns all leagues",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createLeagueRepository({ db, log: createTestLogger() });
    const inserted: string[] = [];

    try {
      const [a] = await db.insert(leagues).values({ name: "League A" })
        .returning();
      const [b] = await db.insert(leagues).values({ name: "League B" })
        .returning();
      inserted.push(a.id, b.id);

      const result = await repo.getAll();
      const names = result.map((l) => l.name);
      assertEquals(names.includes("League A"), true);
      assertEquals(names.includes("League B"), true);
    } finally {
      for (const id of inserted) {
        await db.delete(leagues).where(eq(leagues.id, id));
      }
      await client.end();
    }
  },
});

Deno.test({
  name: "leagueRepository.getById: returns the league when it exists",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createLeagueRepository({ db, log: createTestLogger() });
    let leagueId: string | undefined;

    try {
      const [created] = await db.insert(leagues).values({
        name: "Find Me",
      }).returning();
      leagueId = created.id;

      const result = await repo.getById(leagueId);
      assertEquals(result?.id, leagueId);
      assertEquals(result?.name, "Find Me");
    } finally {
      if (leagueId) {
        await db.delete(leagues).where(eq(leagues.id, leagueId));
      }
      await client.end();
    }
  },
});

Deno.test({
  name: "leagueRepository.getById: returns undefined when not found",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createLeagueRepository({ db, log: createTestLogger() });

    try {
      const result = await repo.getById(crypto.randomUUID());
      assertEquals(result, undefined);
    } finally {
      await client.end();
    }
  },
});

Deno.test({
  name: "leagueRepository.create: inserts and returns the new league",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createLeagueRepository({ db, log: createTestLogger() });
    let leagueId: string | undefined;

    try {
      const result = await repo.create({ name: "New League" });
      leagueId = result.id;

      assertEquals(result.name, "New League");
      assertEquals(typeof result.id, "string");
      assertEquals(result.userTeamId, null);
      assertEquals(result.salaryCap, 255_000_000);
      assertEquals(result.capFloorPercent, 89);
      assertEquals(result.capGrowthRate, 5);
      assertEquals(result.rosterSize, 53);

      const [row] = await db.select().from(leagues).where(
        eq(leagues.id, leagueId),
      );
      assertEquals(row.name, "New League");
      assertEquals(row.userTeamId, null);
      assertEquals(row.salaryCap, 255_000_000);
      assertEquals(row.capFloorPercent, 89);
      assertEquals(row.capGrowthRate, 5);
      assertEquals(row.rosterSize, 53);
    } finally {
      if (leagueId) {
        await db.delete(leagues).where(eq(leagues.id, leagueId));
      }
      await client.end();
    }
  },
});

Deno.test({
  name: "leagueRepository.deleteById: deletes the league from the database",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createLeagueRepository({ db, log: createTestLogger() });

    try {
      const [created] = await db.insert(leagues).values({
        name: "Delete Me",
      }).returning();

      await repo.deleteById(created.id);

      const [row] = await db.select().from(leagues).where(
        eq(leagues.id, created.id),
      );
      assertEquals(row, undefined);
    } finally {
      await client.end();
    }
  },
});
