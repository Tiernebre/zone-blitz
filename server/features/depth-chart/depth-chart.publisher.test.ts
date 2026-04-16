import { assertEquals } from "@std/assert";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import pino from "pino";
import { type NeutralBucket, PLAYER_ATTRIBUTE_KEYS } from "@zone-blitz/shared";
import * as schema from "../../db/schema.ts";
import { players } from "../players/player.schema.ts";
import { playerAttributes } from "../players/attributes.schema.ts";
import { depthChartEntries } from "../players/depth-chart.schema.ts";
import {
  BUCKET_PROFILES,
  stubAttributesFor,
} from "../players/players-generator.ts";
import { coaches } from "../coaches/coach.schema.ts";
import { coachTendencies } from "../coaches/coach-tendencies.schema.ts";
import { leagues } from "../league/league.schema.ts";
import { teams } from "../team/team.schema.ts";
import { franchises } from "../franchise/franchise.schema.ts";
import { cities } from "../cities/city.schema.ts";
import { states } from "../states/state.schema.ts";
import { createDepthChartPublisher } from "./depth-chart.publisher.ts";

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

function sizeFor(bucket: NeutralBucket) {
  return {
    heightInches: BUCKET_PROFILES[bucket].heightInches,
    weightPounds: BUCKET_PROFILES[bucket].weightPounds,
  };
}

function stubAttributeColumns(bucket: NeutralBucket) {
  const attrs = stubAttributesFor(bucket);
  const row: Record<string, number> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    row[key] = attrs[key];
    row[`${key}Potential`] = attrs[`${key}Potential` as keyof typeof attrs];
  }
  return row;
}

async function setupFixtures(db: ReturnType<typeof createTestDb>["db"]) {
  const [league] = await db
    .insert(leagues)
    .values({ name: `League ${crypto.randomUUID()}`, salaryCap: 255_000_000 })
    .returning();
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
      abbreviation: `T${crypto.randomUUID().slice(0, 2).toUpperCase()}`,
      cityId: city.id,
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
  ids: {
    coaches?: string[];
    players?: string[];
    teams?: string[];
    cities?: string[];
    states?: string[];
    leagues?: string[];
  },
) {
  if (ids.coaches?.length) {
    await db.delete(coaches).where(inArray(coaches.id, ids.coaches));
  }
  if (ids.players?.length) {
    await db.delete(players).where(inArray(players.id, ids.players));
  }
  if (ids.teams?.length) {
    await db.delete(teams).where(inArray(teams.id, ids.teams));
  }
  if (ids.cities?.length) {
    await db
      .delete(franchises)
      .where(inArray(franchises.cityId, ids.cities));
    await db.delete(cities).where(inArray(cities.id, ids.cities));
  }
  if (ids.states?.length) {
    await db.delete(states).where(inArray(states.id, ids.states));
  }
  if (ids.leagues?.length) {
    await db.delete(leagues).where(inArray(leagues.id, ids.leagues));
  }
}

Deno.test({
  name:
    "depthChartPublisher.publishForTeams: creates entries for all players on a team",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const publisher = createDepthChartPublisher({
      db,
      log: createTestLogger(),
    });
    const playersCreated: string[] = [];
    const coachesCreated: string[] = [];
    const teamsCreated: string[] = [];
    const citiesCreated: string[] = [];
    const statesCreated: string[] = [];
    const leaguesCreated: string[] = [];
    try {
      const { league, team, state, city } = await setupFixtures(db);
      leaguesCreated.push(league.id);
      teamsCreated.push(team.id);
      statesCreated.push(state.id);
      citiesCreated.push(city.id);

      const hcId = crypto.randomUUID();
      const ocId = crypto.randomUUID();
      const dcId = crypto.randomUUID();
      await db.insert(coaches).values([
        {
          id: hcId,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Head",
          lastName: "Coach",
          role: "HC",
          age: 50,
          hiredAt: new Date("2028-01-01"),
          contractYears: 3,
          contractSalary: 1,
          contractBuyout: 1,
        },
        {
          id: ocId,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Off",
          lastName: "Coordinator",
          role: "OC",
          age: 45,
          hiredAt: new Date("2028-01-01"),
          contractYears: 3,
          contractSalary: 1,
          contractBuyout: 1,
          reportsToId: hcId,
        },
        {
          id: dcId,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Def",
          lastName: "Coordinator",
          role: "DC",
          age: 48,
          hiredAt: new Date("2028-01-01"),
          contractYears: 3,
          contractSalary: 1,
          contractBuyout: 1,
          reportsToId: hcId,
        },
      ]);
      coachesCreated.push(hcId, ocId, dcId);

      await db.insert(coachTendencies).values([
        {
          coachId: ocId,
          runPassLean: 50,
          tempo: 50,
          personnelWeight: 50,
          formationUnderCenterShotgun: 50,
          preSnapMotionRate: 50,
          passingStyle: 50,
          passingDepth: 50,
          runGameBlocking: 50,
          rpoIntegration: 50,
        },
        {
          coachId: dcId,
          frontOddEven: 50,
          gapResponsibility: 50,
          subPackageLean: 50,
          coverageManZone: 50,
          coverageShell: 50,
          cornerPressOff: 50,
          pressureRate: 50,
          disguiseRate: 50,
        },
      ]);

      const buckets: NeutralBucket[] = [
        "QB",
        "QB",
        "RB",
        "RB",
        "WR",
        "WR",
        "WR",
        "TE",
        "TE",
        "OT",
        "OT",
        "IOL",
        "IOL",
        "IOL",
        "EDGE",
        "EDGE",
        "IDL",
        "IDL",
        "LB",
        "LB",
        "LB",
        "CB",
        "CB",
        "CB",
        "S",
        "S",
        "K",
        "P",
        "LS",
      ];

      for (const bucket of buckets) {
        const id = crypto.randomUUID();
        await db.insert(players).values({
          id,
          leagueId: league.id,
          teamId: team.id,
          firstName: bucket,
          lastName: `Player-${id.slice(0, 4)}`,
          injuryStatus: "healthy",
          ...sizeFor(bucket),
          birthDate: "2000-01-01",
        });
        await db.insert(playerAttributes).values({
          playerId: id,
          ...stubAttributeColumns(bucket),
        });
        playersCreated.push(id);
      }

      const result = await publisher.publishForTeams({
        leagueId: league.id,
        teamIds: [team.id],
      });

      assertEquals(result.entryCount, buckets.length);

      const entries = await db
        .select()
        .from(depthChartEntries)
        .where(eq(depthChartEntries.teamId, team.id));

      assertEquals(entries.length, buckets.length);

      const playerIds = new Set(entries.map((e) => e.playerId));
      assertEquals(playerIds.size, buckets.length);

      const keys = entries.map((e) => `${e.slotCode}:${e.slotOrdinal}`);
      assertEquals(new Set(keys).size, keys.length);

      const hcEntries = entries.filter(
        (e) => e.publishedByCoachId === hcId,
      );
      assertEquals(hcEntries.length, buckets.length);
    } finally {
      await cleanup(db, {
        coaches: coachesCreated,
        players: playersCreated,
        teams: teamsCreated,
        cities: citiesCreated,
        states: statesCreated,
        leagues: leaguesCreated,
      });
      await client.end();
    }
  },
});

Deno.test({
  name:
    "depthChartPublisher.publishForTeams: replaces existing entries on re-publish",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const publisher = createDepthChartPublisher({
      db,
      log: createTestLogger(),
    });
    const playersCreated: string[] = [];
    const coachesCreated: string[] = [];
    const teamsCreated: string[] = [];
    const citiesCreated: string[] = [];
    const statesCreated: string[] = [];
    const leaguesCreated: string[] = [];
    try {
      const { league, team, state, city } = await setupFixtures(db);
      leaguesCreated.push(league.id);
      teamsCreated.push(team.id);
      statesCreated.push(state.id);
      citiesCreated.push(city.id);

      const hcId = crypto.randomUUID();
      await db.insert(coaches).values({
        id: hcId,
        leagueId: league.id,
        teamId: team.id,
        firstName: "Head",
        lastName: "Coach",
        role: "HC",
        age: 50,
        hiredAt: new Date("2028-01-01"),
        contractYears: 3,
        contractSalary: 1,
        contractBuyout: 1,
      });
      coachesCreated.push(hcId);

      const qbId = crypto.randomUUID();
      await db.insert(players).values({
        id: qbId,
        leagueId: league.id,
        teamId: team.id,
        firstName: "Test",
        lastName: "QB",
        injuryStatus: "healthy",
        ...sizeFor("QB"),
        birthDate: "2000-01-01",
      });
      await db.insert(playerAttributes).values({
        playerId: qbId,
        ...stubAttributeColumns("QB"),
      });
      playersCreated.push(qbId);

      await publisher.publishForTeams({
        leagueId: league.id,
        teamIds: [team.id],
      });

      const firstRun = await db
        .select()
        .from(depthChartEntries)
        .where(eq(depthChartEntries.teamId, team.id));
      assertEquals(firstRun.length, 1);

      await publisher.publishForTeams({
        leagueId: league.id,
        teamIds: [team.id],
      });

      const secondRun = await db
        .select()
        .from(depthChartEntries)
        .where(eq(depthChartEntries.teamId, team.id));
      assertEquals(secondRun.length, 1);
    } finally {
      await cleanup(db, {
        coaches: coachesCreated,
        players: playersCreated,
        teams: teamsCreated,
        cities: citiesCreated,
        states: statesCreated,
        leagues: leaguesCreated,
      });
      await client.end();
    }
  },
});

Deno.test({
  name:
    "depthChartPublisher.publishForTeams: returns zero entries for team with no players",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const publisher = createDepthChartPublisher({
      db,
      log: createTestLogger(),
    });
    const teamsCreated: string[] = [];
    const citiesCreated: string[] = [];
    const statesCreated: string[] = [];
    const leaguesCreated: string[] = [];
    try {
      const { league, team, state, city } = await setupFixtures(db);
      leaguesCreated.push(league.id);
      teamsCreated.push(team.id);
      statesCreated.push(state.id);
      citiesCreated.push(city.id);

      const result = await publisher.publishForTeams({
        leagueId: league.id,
        teamIds: [team.id],
      });
      assertEquals(result.entryCount, 0);
    } finally {
      await cleanup(db, {
        teams: teamsCreated,
        cities: citiesCreated,
        states: statesCreated,
        leagues: leaguesCreated,
      });
      await client.end();
    }
  },
});
