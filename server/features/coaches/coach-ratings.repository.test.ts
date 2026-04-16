import { assertEquals, assertExists } from "@std/assert";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import pino from "pino";
import * as schema from "../../db/schema.ts";
import { coaches } from "./coach.schema.ts";
import { coachRatings } from "./coach-ratings.schema.ts";
import { leagues } from "../league/league.schema.ts";
import { teams } from "../team/team.schema.ts";
import { franchises } from "../franchise/franchise.schema.ts";
import { cities } from "../cities/city.schema.ts";
import { states } from "../states/state.schema.ts";
import { createCoachRatingsRepository } from "./coach-ratings.repository.ts";

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
    coachIds: string[];
    teamIds: string[];
    franchiseIds: string[];
    cityIds: string[];
    stateIds: string[];
    leagueIds: string[];
  },
) {
  if (ctx.coachIds.length > 0) {
    await db.delete(coachRatings).where(
      inArray(coachRatings.coachId, ctx.coachIds),
    );
    await db.delete(coaches).where(inArray(coaches.id, ctx.coachIds));
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
    leadership: 70,
    gameManagement: 65,
    schemeMastery: 55,
    playerDevelopment: 50,
    adaptability: 60,
  },
  ceiling: {
    leadership: 80,
    gameManagement: 75,
    schemeMastery: 70,
    playerDevelopment: 68,
    adaptability: 72,
  },
  growthRate: 55,
};

Deno.test({
  name:
    "coachRatingsRepository.getByCoachId: returns undefined when no row exists",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createCoachRatingsRepository({
      db,
      log: createTestLogger(),
    });
    try {
      const result = await repo.getByCoachId(crypto.randomUUID());
      assertEquals(result, undefined);
    } finally {
      await client.end();
    }
  },
});

Deno.test({
  name:
    "coachRatingsRepository.upsert: inserts full rating row and reads it back",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createCoachRatingsRepository({
      db,
      log: createTestLogger(),
    });
    const ctx = {
      coachIds: [] as string[],
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

      const coachId = crypto.randomUUID();
      await db.insert(coaches).values({
        id: coachId,
        leagueId: league.id,
        teamId: team.id,
        firstName: "Kyle",
        lastName: "Ratings",
        role: "OC",
        age: 42,
        hiredAt: new Date("2028-01-01T00:00:00Z"),
        contractYears: 3,
        contractSalary: 3_000_000,
        contractBuyout: 4_000_000,
        specialty: "offense",
      });
      ctx.coachIds.push(coachId);

      const saved = await repo.upsert({ coachId, ...SAMPLE_RATINGS });
      assertEquals(saved.coachId, coachId);
      assertEquals(saved.current.leadership, 70);
      assertEquals(saved.ceiling.leadership, 80);
      assertEquals(saved.growthRate, 55);

      const fetched = await repo.getByCoachId(coachId);
      assertExists(fetched);
      assertEquals(fetched?.current.schemeMastery, 55);
      assertEquals(fetched?.ceiling.playerDevelopment, 68);
      assertEquals(fetched?.growthRate, 55);
    } finally {
      await cleanup(db, ctx);
      await client.end();
    }
  },
});

Deno.test({
  name: "coachRatingsRepository.upsert: overwrites existing row in place",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createCoachRatingsRepository({
      db,
      log: createTestLogger(),
    });
    const ctx = {
      coachIds: [] as string[],
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

      const coachId = crypto.randomUUID();
      await db.insert(coaches).values({
        id: coachId,
        leagueId: league.id,
        teamId: team.id,
        firstName: "Growth",
        lastName: "Track",
        role: "HC",
        playCaller: "offense",
        age: 45,
        hiredAt: new Date("2028-01-01T00:00:00Z"),
        contractYears: 4,
        contractSalary: 10_000_000,
        contractBuyout: 20_000_000,
        specialty: "offense",
      });
      ctx.coachIds.push(coachId);

      await repo.upsert({ coachId, ...SAMPLE_RATINGS });
      const updated = await repo.upsert({
        coachId,
        current: { ...SAMPLE_RATINGS.current, leadership: 90 },
        ceiling: { ...SAMPLE_RATINGS.ceiling, leadership: 95 },
        growthRate: 30,
      });

      assertEquals(updated.current.leadership, 90);
      assertEquals(updated.ceiling.leadership, 95);
      assertEquals(updated.growthRate, 30);
    } finally {
      await cleanup(db, ctx);
      await client.end();
    }
  },
});
