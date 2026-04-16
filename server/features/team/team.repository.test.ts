import { assertEquals } from "@std/assert";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema.ts";
import { teams } from "./team.schema.ts";
import { franchises } from "../franchise/franchise.schema.ts";
import { leagues } from "../league/league.schema.ts";
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

function shortAbbr() {
  return `T${crypto.randomUUID().slice(0, 2).toUpperCase()}`;
}

async function setupFixtures(db: ReturnType<typeof createTestDb>["db"]) {
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
  const [league] = await db
    .insert(leagues)
    .values({ name: `League ${crypto.randomUUID()}` })
    .returning();
  const [franchise] = await db
    .insert(franchises)
    .values({
      name: "Test Franchise",
      cityId: city.id,
      abbreviation: shortAbbr(),
      primaryColor: "#000000",
      secondaryColor: "#FFFFFF",
      accentColor: "#FF0000",
      backstory: "A test franchise backstory.",
      conference: "AFC",
      division: "AFC East",
    })
    .returning();
  return { state, city, league, franchise };
}

async function teardown(
  db: ReturnType<typeof createTestDb>["db"],
  ids: {
    teamIds: string[];
    franchiseIds: string[];
    leagueIds: string[];
    cityIds: string[];
    stateIds: string[];
  },
) {
  for (const id of ids.teamIds) {
    await db.delete(teams).where(eq(teams.id, id));
  }
  for (const id of ids.franchiseIds) {
    await db.delete(franchises).where(eq(franchises.id, id));
  }
  for (const id of ids.leagueIds) {
    await db.delete(leagues).where(eq(leagues.id, id));
  }
  for (const id of ids.cityIds) {
    await db.delete(cities).where(eq(cities.id, id));
  }
  for (const id of ids.stateIds) {
    await db.delete(states).where(eq(states.id, id));
  }
}

function buildTeamInput(
  leagueId: string,
  franchiseId: string,
  cityId: string,
  overrides: Partial<{
    name: string;
    abbreviation: string;
    conference: string;
    division: string;
  }> = {},
) {
  return {
    leagueId,
    franchiseId,
    name: overrides.name ?? "Test Team",
    cityId,
    abbreviation: overrides.abbreviation ?? shortAbbr(),
    primaryColor: "#000000",
    secondaryColor: "#FFFFFF",
    accentColor: "#FF0000",
    backstory: "A test franchise backstory.",
    conference: overrides.conference ?? "AFC",
    division: overrides.division ?? "AFC East",
    marketTier: "medium" as const,
  };
}

Deno.test({
  name: "teamRepository.createMany: inserts and returns hydrated teams",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createTeamRepository({ db, log: createTestLogger() });
    const teamIds: string[] = [];
    const franchiseIds: string[] = [];
    const leagueIds: string[] = [];
    const cityIds: string[] = [];
    const stateIds: string[] = [];

    try {
      const fx = await setupFixtures(db);
      leagueIds.push(fx.league.id);
      franchiseIds.push(fx.franchise.id);
      cityIds.push(fx.city.id);
      stateIds.push(fx.state.id);

      const created = await repo.createMany([
        buildTeamInput(fx.league.id, fx.franchise.id, fx.city.id, {
          name: "Team A",
        }),
      ]);
      for (const t of created) teamIds.push(t.id);

      assertEquals(created.length, 1);
      assertEquals(created[0].name, "Team A");
      assertEquals(created[0].leagueId, fx.league.id);
      assertEquals(created[0].franchiseId, fx.franchise.id);
      assertEquals(typeof created[0].city, "string");
      assertEquals(typeof created[0].state, "string");
    } finally {
      await teardown(db, {
        teamIds,
        franchiseIds,
        leagueIds,
        cityIds,
        stateIds,
      });
      await client.end();
    }
  },
});

Deno.test({
  name: "teamRepository.createMany: returns empty array when given no rows",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createTeamRepository({ db, log: createTestLogger() });
    try {
      const result = await repo.createMany([]);
      assertEquals(result, []);
    } finally {
      await client.end();
    }
  },
});

Deno.test({
  name: "teamRepository.getByLeagueId: returns only teams for the league",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createTeamRepository({ db, log: createTestLogger() });
    const teamIds: string[] = [];
    const franchiseIds: string[] = [];
    const leagueIds: string[] = [];
    const cityIds: string[] = [];
    const stateIds: string[] = [];

    try {
      const fx = await setupFixtures(db);
      leagueIds.push(fx.league.id);
      franchiseIds.push(fx.franchise.id);
      cityIds.push(fx.city.id);
      stateIds.push(fx.state.id);

      const [other] = await db
        .insert(leagues)
        .values({ name: `OtherLeague ${crypto.randomUUID()}` })
        .returning();
      leagueIds.push(other.id);

      const created = await repo.createMany([
        buildTeamInput(fx.league.id, fx.franchise.id, fx.city.id, {
          name: "Mine",
        }),
      ]);
      for (const t of created) teamIds.push(t.id);

      const result = await repo.getByLeagueId(fx.league.id);
      assertEquals(result.length, 1);
      assertEquals(result[0].name, "Mine");

      const empty = await repo.getByLeagueId(other.id);
      assertEquals(empty, []);
    } finally {
      await teardown(db, {
        teamIds,
        franchiseIds,
        leagueIds,
        cityIds,
        stateIds,
      });
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
    const teamIds: string[] = [];
    const franchiseIds: string[] = [];
    const leagueIds: string[] = [];
    const cityIds: string[] = [];
    const stateIds: string[] = [];

    try {
      const fx = await setupFixtures(db);
      leagueIds.push(fx.league.id);
      franchiseIds.push(fx.franchise.id);
      cityIds.push(fx.city.id);
      stateIds.push(fx.state.id);

      const [created] = await repo.createMany([
        buildTeamInput(fx.league.id, fx.franchise.id, fx.city.id, {
          name: "Find Me",
        }),
      ]);
      teamIds.push(created.id);

      const result = await repo.getById(created.id);
      assertEquals(result?.id, created.id);
      assertEquals(result?.name, "Find Me");
      assertEquals(result?.cityId, fx.city.id);
    } finally {
      await teardown(db, {
        teamIds,
        franchiseIds,
        leagueIds,
        cityIds,
        stateIds,
      });
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
  name: "teamRepository.getById: hydrates city and state from join",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createTeamRepository({ db, log: createTestLogger() });
    const teamIds: string[] = [];
    const franchiseIds: string[] = [];
    const leagueIds: string[] = [];
    const cityIds: string[] = [];
    const stateIds: string[] = [];

    try {
      const fx = await setupFixtures(db);
      leagueIds.push(fx.league.id);
      franchiseIds.push(fx.franchise.id);
      cityIds.push(fx.city.id);
      stateIds.push(fx.state.id);

      const [stateRow] = await db
        .select({ code: states.code })
        .from(states)
        .where(eq(states.id, fx.state.id));
      const [cityRow] = await db
        .select({ name: cities.name })
        .from(cities)
        .where(eq(cities.id, fx.city.id));

      const [created] = await repo.createMany([
        buildTeamInput(fx.league.id, fx.franchise.id, fx.city.id, {
          name: "Hydrated",
        }),
      ]);
      teamIds.push(created.id);

      const result = await repo.getById(created.id);
      assertEquals(result?.city, cityRow.name);
      assertEquals(result?.state, stateRow.code);
    } finally {
      await teardown(db, {
        teamIds,
        franchiseIds,
        leagueIds,
        cityIds,
        stateIds,
      });
      await client.end();
    }
  },
});
