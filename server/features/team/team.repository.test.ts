import { assertEquals } from "@std/assert";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema.ts";
import { teams } from "./team.schema.ts";
import { createTeamRepository } from "./team.repository.ts";
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

function createTestTeam(overrides: Partial<typeof teams.$inferInsert> = {}) {
  return {
    name: "Test Team",
    city: "Test City",
    abbreviation: `T${crypto.randomUUID().slice(0, 2).toUpperCase()}`,
    primaryColor: "#000000",
    secondaryColor: "#FFFFFF",
    accentColor: "#FF0000",
    conference: "AFC",
    division: "AFC East",
    ...overrides,
  };
}

Deno.test({
  name: "teamRepository.getAll: returns all teams",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createTeamRepository({ db, log: createTestLogger() });
    const inserted: string[] = [];

    try {
      const [a] = await db
        .insert(teams)
        .values(createTestTeam({ name: "Team A" }))
        .returning();
      const [b] = await db
        .insert(teams)
        .values(createTestTeam({ name: "Team B" }))
        .returning();
      inserted.push(a.id, b.id);

      const result = await repo.getAll();
      const names = result.map((t) => t.name);
      assertEquals(names.includes("Team A"), true);
      assertEquals(names.includes("Team B"), true);
    } finally {
      for (const id of inserted) {
        await db.delete(teams).where(eq(teams.id, id));
      }
      await client.end();
    }
  },
});

Deno.test({
  name: "teamRepository.getById: returns the team when it exists",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createTeamRepository({ db, log: createTestLogger() });
    let teamId: string | undefined;

    try {
      const [created] = await db
        .insert(teams)
        .values(createTestTeam({ name: "Find Me" }))
        .returning();
      teamId = created.id;

      const result = await repo.getById(teamId);
      assertEquals(result?.id, teamId);
      assertEquals(result?.name, "Find Me");
    } finally {
      if (teamId) {
        await db.delete(teams).where(eq(teams.id, teamId));
      }
      await client.end();
    }
  },
});

Deno.test({
  name: "teamRepository.getById: returns undefined when not found",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createTeamRepository({ db, log: createTestLogger() });

    try {
      const result = await repo.getById(crypto.randomUUID());
      assertEquals(result, undefined);
    } finally {
      await client.end();
    }
  },
});
