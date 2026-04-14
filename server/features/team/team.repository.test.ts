import { assertEquals } from "@std/assert";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema.ts";
import { teams } from "./team.schema.ts";
import { cities } from "../cities/city.schema.ts";
import { states } from "../states/state.schema.ts";
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

async function createTestCity(db: ReturnType<typeof createTestDb>["db"]) {
  const [state] = await db
    .insert(states)
    .values({
      code: `test-${crypto.randomUUID()}`,
      name: `TestState-${crypto.randomUUID()}`,
      region: "West",
    })
    .returning();
  const [city] = await db
    .insert(cities)
    .values({
      name: `TestCity-${crypto.randomUUID()}`,
      stateId: state.id,
    })
    .returning();
  return { stateId: state.id, cityId: city.id };
}

function createTestTeam(
  cityId: string,
  overrides: Partial<typeof teams.$inferInsert> = {},
) {
  return {
    name: "Test Team",
    cityId,
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
    const insertedTeamIds: string[] = [];
    let fixture: { stateId: string; cityId: string } | undefined;

    try {
      fixture = await createTestCity(db);
      const [a] = await db
        .insert(teams)
        .values(createTestTeam(fixture.cityId, { name: "Team A" }))
        .returning();
      const [b] = await db
        .insert(teams)
        .values(createTestTeam(fixture.cityId, { name: "Team B" }))
        .returning();
      insertedTeamIds.push(a.id, b.id);

      const result = await repo.getAll();
      const names = result.map((t) => t.name);
      assertEquals(names.includes("Team A"), true);
      assertEquals(names.includes("Team B"), true);
    } finally {
      for (const id of insertedTeamIds) {
        await db.delete(teams).where(eq(teams.id, id));
      }
      if (fixture) {
        await db.delete(cities).where(eq(cities.id, fixture.cityId));
        await db.delete(states).where(eq(states.id, fixture.stateId));
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
    let fixture: { stateId: string; cityId: string } | undefined;

    try {
      fixture = await createTestCity(db);
      const [created] = await db
        .insert(teams)
        .values(createTestTeam(fixture.cityId, { name: "Find Me" }))
        .returning();
      teamId = created.id;

      const result = await repo.getById(teamId);
      assertEquals(result?.id, teamId);
      assertEquals(result?.name, "Find Me");
      assertEquals(result?.cityId, fixture.cityId);
    } finally {
      if (teamId) {
        await db.delete(teams).where(eq(teams.id, teamId));
      }
      if (fixture) {
        await db.delete(cities).where(eq(cities.id, fixture.cityId));
        await db.delete(states).where(eq(states.id, fixture.stateId));
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

Deno.test({
  name: "teamRepository.getAll: hydrates city and state from join",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createTeamRepository({ db, log: createTestLogger() });
    let teamId: string | undefined;
    let fixture: { stateId: string; cityId: string } | undefined;

    try {
      fixture = await createTestCity(db);
      const [stateRow] = await db
        .select({ code: states.code })
        .from(states)
        .where(eq(states.id, fixture.stateId));
      const [cityRow] = await db
        .select({ name: cities.name })
        .from(cities)
        .where(eq(cities.id, fixture.cityId));
      const [created] = await db
        .insert(teams)
        .values(createTestTeam(fixture.cityId, { name: "Hydrated" }))
        .returning();
      teamId = created.id;

      const result = await repo.getById(teamId);
      assertEquals(result?.city, cityRow.name);
      assertEquals(result?.state, stateRow.code);
    } finally {
      if (teamId) {
        await db.delete(teams).where(eq(teams.id, teamId));
      }
      if (fixture) {
        await db.delete(cities).where(eq(cities.id, fixture.cityId));
        await db.delete(states).where(eq(states.id, fixture.stateId));
      }
      await client.end();
    }
  },
});
