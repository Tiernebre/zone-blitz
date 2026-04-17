import { assertEquals, assertExists } from "@std/assert";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import pino from "pino";
import * as schema from "../../db/schema.ts";
import { scouts } from "./scout.schema.ts";
import { scoutRatings } from "./scout-ratings.schema.ts";
import { leagues } from "../league/league.schema.ts";
import { teams } from "../team/team.schema.ts";
import { franchises } from "../franchise/franchise.schema.ts";
import { cities } from "../cities/city.schema.ts";
import { states } from "../states/state.schema.ts";
import { createScoutRatingsRepository } from "./scout-ratings.repository.ts";

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

async function setupFixtures(db: ReturnType<typeof createTestDb>["db"]) {
  const [league] = await db
    .insert(leagues)
    .values({ name: `League ${crypto.randomUUID()}` })
    .returning();
  const [state] = await db
    .insert(states)
    .values({
      code: `tt-${crypto.randomUUID().slice(0, 8)}`,
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
  const [franchise] = await db
    .insert(franchises)
    .values({
      name: "Test Franchise",
      cityId: city.id,
      abbreviation: `T${crypto.randomUUID().slice(0, 2).toUpperCase()}`,
      primaryColor: "#000000",
      secondaryColor: "#FFFFFF",
      accentColor: "#FF0000",
      conference: "AFC",
      division: "AFC East",
    })
    .returning();
  const [team] = await db
    .insert(teams)
    .values({
      leagueId: league.id,
      franchiseId: franchise.id,
      name: "Test Team",
      cityId: city.id,
      abbreviation: `T${crypto.randomUUID().slice(0, 2).toUpperCase()}`,
      primaryColor: "#000000",
      secondaryColor: "#FFFFFF",
      accentColor: "#FF0000",
      conference: "AFC",
      division: "AFC East",
    })
    .returning();
  return { league, team, state, city, franchise };
}

async function cleanup(
  db: ReturnType<typeof createTestDb>["db"],
  ctx: {
    scoutIds: string[];
    teamIds: string[];
    franchiseIds: string[];
    cityIds: string[];
    stateIds: string[];
    leagueIds: string[];
  },
) {
  if (ctx.scoutIds.length > 0) {
    await db.delete(scoutRatings).where(
      inArray(scoutRatings.scoutId, ctx.scoutIds),
    );
    await db.delete(scouts).where(inArray(scouts.id, ctx.scoutIds));
  }
  for (const id of ctx.teamIds) {
    await db.delete(teams).where(eq(teams.id, id));
  }
  for (const id of ctx.franchiseIds) {
    await db.delete(franchises).where(eq(franchises.id, id));
  }
  for (const id of ctx.cityIds) {
    await db.delete(cities).where(eq(cities.id, id));
  }
  for (const id of ctx.stateIds) {
    await db.delete(states).where(eq(states.id, id));
  }
  for (const id of ctx.leagueIds) {
    await db.delete(leagues).where(eq(leagues.id, id));
  }
}

const SAMPLE_RATINGS = {
  current: {
    accuracy: 70,
    projection: 55,
    intangibleRead: 60,
    confidenceCalibration: 58,
    biasResistance: 52,
  },
  ceiling: {
    accuracy: 85,
    projection: 70,
    intangibleRead: 72,
    confidenceCalibration: 75,
    biasResistance: 68,
  },
  growthRate: 55,
};

Deno.test({
  name:
    "scoutRatingsRepository.getByScoutId: returns undefined when no row exists",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createScoutRatingsRepository({
      db,
      log: createTestLogger(),
    });
    try {
      const result = await repo.getByScoutId(crypto.randomUUID());
      assertEquals(result, undefined);
    } finally {
      await client.end();
    }
  },
});

Deno.test({
  name:
    "scoutRatingsRepository.upsert: inserts full rating row and reads it back",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createScoutRatingsRepository({
      db,
      log: createTestLogger(),
    });
    const ctx = {
      scoutIds: [] as string[],
      teamIds: [] as string[],
      franchiseIds: [] as string[],
      cityIds: [] as string[],
      stateIds: [] as string[],
      leagueIds: [] as string[],
    };
    try {
      const { league, team, state, city, franchise } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);
      ctx.teamIds.push(team.id);
      ctx.franchiseIds.push(franchise.id);
      ctx.cityIds.push(city.id);
      ctx.stateIds.push(state.id);

      const scoutId = crypto.randomUUID();
      await db.insert(scouts).values({
        id: scoutId,
        leagueId: league.id,
        teamId: team.id,
        firstName: "Ivy",
        lastName: "Eye",
        role: "AREA_SCOUT",
        age: 38,
        hiredAt: new Date("2028-01-01T00:00:00Z"),
        contractYears: 2,
        contractSalary: 150_000,
        contractBuyout: 200_000,
        workCapacity: 120,
      });
      ctx.scoutIds.push(scoutId);

      const saved = await repo.upsert({ scoutId, ...SAMPLE_RATINGS });
      assertEquals(saved.scoutId, scoutId);
      assertEquals(saved.current.accuracy, 70);
      assertEquals(saved.ceiling.accuracy, 85);
      assertEquals(saved.growthRate, 55);

      const fetched = await repo.getByScoutId(scoutId);
      assertExists(fetched);
      assertEquals(fetched?.current.projection, 55);
      assertEquals(fetched?.ceiling.biasResistance, 68);
      assertEquals(fetched?.growthRate, 55);
    } finally {
      await cleanup(db, ctx);
      await client.end();
    }
  },
});

Deno.test({
  name: "scoutRatingsRepository.upsert: overwrites existing row in place",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createScoutRatingsRepository({
      db,
      log: createTestLogger(),
    });
    const ctx = {
      scoutIds: [] as string[],
      teamIds: [] as string[],
      franchiseIds: [] as string[],
      cityIds: [] as string[],
      stateIds: [] as string[],
      leagueIds: [] as string[],
    };
    try {
      const { league, team, state, city, franchise } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);
      ctx.teamIds.push(team.id);
      ctx.franchiseIds.push(franchise.id);
      ctx.cityIds.push(city.id);
      ctx.stateIds.push(state.id);

      const scoutId = crypto.randomUUID();
      await db.insert(scouts).values({
        id: scoutId,
        leagueId: league.id,
        teamId: team.id,
        firstName: "Ivy",
        lastName: "Eye",
        role: "DIRECTOR",
        age: 55,
        hiredAt: new Date("2028-01-01T00:00:00Z"),
        contractYears: 4,
        contractSalary: 500_000,
        contractBuyout: 800_000,
        workCapacity: 200,
      });
      ctx.scoutIds.push(scoutId);

      await repo.upsert({ scoutId, ...SAMPLE_RATINGS });
      const updated = await repo.upsert({
        scoutId,
        current: { ...SAMPLE_RATINGS.current, accuracy: 92 },
        ceiling: { ...SAMPLE_RATINGS.ceiling, accuracy: 96 },
        growthRate: 30,
      });

      assertEquals(updated.current.accuracy, 92);
      assertEquals(updated.ceiling.accuracy, 96);
      assertEquals(updated.growthRate, 30);
    } finally {
      await cleanup(db, ctx);
      await client.end();
    }
  },
});
