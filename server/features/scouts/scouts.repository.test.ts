import { assertEquals } from "@std/assert";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import pino from "pino";
import * as schema from "../../db/schema.ts";
import { scouts } from "./scout.schema.ts";
import {
  scoutCareerStops,
  scoutConnections,
  scoutCrossChecks,
  scoutEvaluations,
  scoutExternalTrackRecord,
  scoutReputationLabels,
} from "./scout-history.schema.ts";
import { leagues } from "../league/league.schema.ts";
import { teams } from "../team/team.schema.ts";
import { franchises } from "../franchise/franchise.schema.ts";
import { cities } from "../cities/city.schema.ts";
import { states } from "../states/state.schema.ts";
import { createScoutsRepository } from "./scouts.repository.ts";

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

Deno.test({
  name: "scoutsRepository.getStaffTreeByTeam: returns flat nodes for the team",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createScoutsRepository({
      db,
      log: createTestLogger(),
      now: () => new Date("2030-01-01T00:00:00Z"),
    });
    const scoutsCreated: string[] = [];
    const teamsCreated: string[] = [];
    const franchisesCreated: string[] = [];
    const leaguesCreated: string[] = [];
    const citiesCreated: string[] = [];
    const statesCreated: string[] = [];

    try {
      const { league, team, state, city, franchise } = await setupFixtures(db);
      leaguesCreated.push(league.id);
      teamsCreated.push(team.id);
      franchisesCreated.push(franchise.id);
      citiesCreated.push(city.id);
      statesCreated.push(state.id);

      const dirId = crypto.randomUUID();
      const ccId = crypto.randomUUID();
      await db.insert(scouts).values([
        {
          id: dirId,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Sam",
          lastName: "Director",
          role: "DIRECTOR",
          reportsToId: null,
          coverage: null,
          age: 58,
          hiredAt: new Date("2027-01-01T00:00:00Z"),
          contractYears: 4,
          contractSalary: 1_500_000,
          contractBuyout: 2_000_000,
          workCapacity: 200,
        },
        {
          id: ccId,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Chris",
          lastName: "Checker",
          role: "NATIONAL_CROSS_CHECKER",
          reportsToId: dirId,
          coverage: "East",
          age: 50,
          hiredAt: new Date("2028-01-01T00:00:00Z"),
          contractYears: 3,
          contractSalary: 750_000,
          contractBuyout: 1_000_000,
          workCapacity: 180,
        },
      ]);
      scoutsCreated.push(dirId, ccId);

      const tree = await repo.getStaffTreeByTeam(league.id, team.id);
      assertEquals(tree.length, 2);

      const director = tree.find((s) => s.id === dirId);
      assertEquals(director?.role, "DIRECTOR");
      assertEquals(director?.reportsToId, null);
      assertEquals(director?.yearsWithTeam, 3);
      assertEquals(director?.workCapacity, 200);

      const cc = tree.find((s) => s.id === ccId);
      assertEquals(cc?.role, "NATIONAL_CROSS_CHECKER");
      assertEquals(cc?.reportsToId, dirId);
      assertEquals(cc?.coverage, "East");
    } finally {
      if (scoutsCreated.length > 0) {
        await db.delete(scouts).where(inArray(scouts.id, scoutsCreated));
      }
      for (const id of teamsCreated) {
        await db.delete(teams).where(eq(teams.id, id));
      }
      for (const id of franchisesCreated) {
        await db.delete(franchises).where(eq(franchises.id, id));
      }
      for (const id of citiesCreated) {
        await db.delete(cities).where(eq(cities.id, id));
      }
      for (const id of statesCreated) {
        await db.delete(states).where(eq(states.id, id));
      }
      for (const id of leaguesCreated) {
        await db.delete(leagues).where(eq(leagues.id, id));
      }
      await client.end();
    }
  },
});

Deno.test({
  name:
    "scoutsRepository.getScoutDetailById: aggregates reputation, resume, evaluations, cross-checks, external record, and connections",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createScoutsRepository({
      db,
      log: createTestLogger(),
      now: () => new Date("2030-01-01T00:00:00Z"),
    });
    const scoutsCreated: string[] = [];
    const teamsCreated: string[] = [];
    const franchisesCreated: string[] = [];
    const leaguesCreated: string[] = [];
    const citiesCreated: string[] = [];
    const statesCreated: string[] = [];

    try {
      const { league, team, state, city, franchise } = await setupFixtures(db);
      leaguesCreated.push(league.id);
      teamsCreated.push(team.id);
      franchisesCreated.push(franchise.id);
      citiesCreated.push(city.id);
      statesCreated.push(state.id);

      const scoutId = crypto.randomUUID();
      const peerId = crypto.randomUUID();

      await db.insert(scouts).values([
        {
          id: scoutId,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Under",
          lastName: "Study",
          role: "AREA_SCOUT",
          coverage: "Southeast",
          age: 42,
          hiredAt: new Date("2028-01-01T00:00:00Z"),
          contractYears: 2,
          contractSalary: 250_000,
          contractBuyout: 300_000,
          workCapacity: 120,
        },
        {
          id: peerId,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Peer",
          lastName: "Buddy",
          role: "AREA_SCOUT",
          coverage: "Northeast",
          age: 43,
          hiredAt: new Date("2028-01-01T00:00:00Z"),
          contractYears: 2,
          contractSalary: 250_000,
          contractBuyout: 300_000,
          workCapacity: 120,
        },
      ]);
      scoutsCreated.push(scoutId, peerId);

      await db.insert(scoutReputationLabels).values([
        { scoutId, label: "respected ACC evaluator" },
        { scoutId, label: "known for small-school finds" },
      ]);
      await db.insert(scoutCareerStops).values({
        scoutId,
        orgName: "Lions",
        role: "Area Scout",
        startYear: 2018,
        endYear: 2022,
        coverageNotes: "ACC + SEC",
      });
      const [evaluation] = await db
        .insert(scoutEvaluations)
        .values({
          scoutId,
          prospectName: "Rookie Back",
          draftYear: 2029,
          positionGroup: "RB",
          roundTier: "4-5",
          grade: "late-round flyer",
          evaluationLevel: "standard",
          outcome: "contributor",
          outcomeDetail: "3rd-string RB, 200 career yards",
        })
        .returning();
      await db.insert(scoutCrossChecks).values({
        evaluationId: evaluation.id,
        otherScoutId: peerId,
        otherGrade: "UDFA",
        winner: "this",
      });
      await db.insert(scoutExternalTrackRecord).values({
        scoutId,
        orgName: "Tigers",
        startYear: 2015,
        endYear: 2018,
        noisyHitRateLabel: "above-average on Day 3 picks",
      });
      await db.insert(scoutConnections).values({
        scoutId,
        otherScoutId: peerId,
        relation: "peer",
      });

      const detail = await repo.getScoutDetailById(scoutId);
      assertEquals(detail?.id, scoutId);
      assertEquals(detail?.yearsWithTeam, 2);
      assertEquals(detail?.reputationLabels.length, 2);
      assertEquals(detail?.careerStops.length, 1);
      assertEquals(detail?.careerStops[0].orgName, "Lions");
      assertEquals(detail?.evaluations.length, 1);
      assertEquals(detail?.evaluations[0].outcome, "contributor");
      assertEquals(detail?.crossChecks.length, 1);
      assertEquals(detail?.crossChecks[0].otherScout?.id, peerId);
      assertEquals(detail?.externalTrackRecord.length, 1);
      assertEquals(detail?.connections.length, 1);
      assertEquals(detail?.connections[0].scout.id, peerId);
    } finally {
      if (scoutsCreated.length > 0) {
        await db.delete(scouts).where(inArray(scouts.id, scoutsCreated));
      }
      for (const id of teamsCreated) {
        await db.delete(teams).where(eq(teams.id, id));
      }
      for (const id of franchisesCreated) {
        await db.delete(franchises).where(eq(franchises.id, id));
      }
      for (const id of citiesCreated) {
        await db.delete(cities).where(eq(cities.id, id));
      }
      for (const id of statesCreated) {
        await db.delete(states).where(eq(states.id, id));
      }
      for (const id of leaguesCreated) {
        await db.delete(leagues).where(eq(leagues.id, id));
      }
      await client.end();
    }
  },
});

Deno.test({
  name: "scoutsRepository.getScoutDetailById: returns undefined when not found",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createScoutsRepository({ db, log: createTestLogger() });
    try {
      const result = await repo.getScoutDetailById(crypto.randomUUID());
      assertEquals(result, undefined);
    } finally {
      await client.end();
    }
  },
});
