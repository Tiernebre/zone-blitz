import { assertEquals, assertExists } from "@std/assert";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import pino from "pino";
import * as schema from "../../db/schema.ts";
import { coaches } from "./coach.schema.ts";
import { coachTendencies } from "./coach-tendencies.schema.ts";
import { leagues } from "../league/league.schema.ts";
import { teams } from "../team/team.schema.ts";
import { cities } from "../cities/city.schema.ts";
import { states } from "../states/state.schema.ts";
import { createCoachTendenciesRepository } from "./coach-tendencies.repository.ts";

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
  const [team] = await db
    .insert(teams)
    .values({
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
  return { league, team, state, city };
}

async function cleanup(
  db: ReturnType<typeof createTestDb>["db"],
  ctx: {
    coachIds: string[];
    teamIds: string[];
    cityIds: string[];
    stateIds: string[];
    leagueIds: string[];
  },
) {
  if (ctx.coachIds.length > 0) {
    await db.delete(coaches).where(inArray(coaches.id, ctx.coachIds));
  }
  for (const id of ctx.teamIds) {
    await db.delete(teams).where(eq(teams.id, id));
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

Deno.test({
  name:
    "coachTendenciesRepository.getByCoachId: returns undefined when no row exists",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createCoachTendenciesRepository({
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
    "coachTendenciesRepository.upsert: inserts offensive-only vector and reads back with defense null",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createCoachTendenciesRepository({
      db,
      log: createTestLogger(),
    });
    const ctx = {
      coachIds: [] as string[],
      teamIds: [] as string[],
      cityIds: [] as string[],
      stateIds: [] as string[],
      leagueIds: [] as string[],
    };
    try {
      const { league, team, state, city } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);
      ctx.teamIds.push(team.id);
      ctx.cityIds.push(city.id);
      ctx.stateIds.push(state.id);

      const ocId = crypto.randomUUID();
      await db.insert(coaches).values({
        id: ocId,
        leagueId: league.id,
        teamId: team.id,
        firstName: "Kyle",
        lastName: "Shanny",
        role: "OC",
        age: 45,
        hiredAt: new Date("2028-01-01T00:00:00Z"),
        contractYears: 3,
        contractSalary: 3_000_000,
        contractBuyout: 4_000_000,
        specialty: "offense",
      });
      ctx.coachIds.push(ocId);

      const saved = await repo.upsert({
        coachId: ocId,
        runPassLean: 55,
        tempo: 70,
        personnelWeight: 40,
        formationUnderCenterShotgun: 25,
        preSnapMotionRate: 85,
        passingStyle: 20,
        passingDepth: 40,
        runGameBlocking: 10,
        rpoIntegration: 30,
      });
      assertEquals(saved.coachId, ocId);
      assertExists(saved.offense);
      assertEquals(saved.offense?.preSnapMotionRate, 85);
      assertEquals(saved.defense, null);

      const fetched = await repo.getByCoachId(ocId);
      assertExists(fetched);
      assertEquals(fetched?.offense?.runPassLean, 55);
      assertEquals(fetched?.defense, null);
    } finally {
      await cleanup(db, ctx);
      await client.end();
    }
  },
});

Deno.test({
  name:
    "coachTendenciesRepository.upsert: merges defensive update into existing offensive row without overwriting",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createCoachTendenciesRepository({
      db,
      log: createTestLogger(),
    });
    const ctx = {
      coachIds: [] as string[],
      teamIds: [] as string[],
      cityIds: [] as string[],
      stateIds: [] as string[],
      leagueIds: [] as string[],
    };
    try {
      const { league, team, state, city } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);
      ctx.teamIds.push(team.id);
      ctx.cityIds.push(city.id);
      ctx.stateIds.push(state.id);

      const hcId = crypto.randomUUID();
      await db.insert(coaches).values({
        id: hcId,
        leagueId: league.id,
        teamId: team.id,
        firstName: "Play",
        lastName: "Caller",
        role: "HC",
        playCaller: "offense",
        age: 55,
        hiredAt: new Date("2028-01-01T00:00:00Z"),
        contractYears: 4,
        contractSalary: 10_000_000,
        contractBuyout: 20_000_000,
        specialty: "offense",
      });
      ctx.coachIds.push(hcId);

      await repo.upsert({
        coachId: hcId,
        runPassLean: 60,
        tempo: 50,
      });
      const merged = await repo.upsert({
        coachId: hcId,
        coverageManZone: 70,
        pressureRate: 80,
      });

      assertEquals(merged.offense?.runPassLean, 60);
      assertEquals(merged.offense?.tempo, 50);
      assertEquals(merged.defense?.coverageManZone, 70);
      assertEquals(merged.defense?.pressureRate, 80);
    } finally {
      await db.delete(coachTendencies).where(
        inArray(coachTendencies.coachId, ctx.coachIds),
      );
      await cleanup(db, ctx);
      await client.end();
    }
  },
});
