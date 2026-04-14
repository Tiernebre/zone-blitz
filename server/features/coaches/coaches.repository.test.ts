import { assertEquals } from "@std/assert";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import pino from "pino";
import * as schema from "../../db/schema.ts";
import { coaches } from "./coach.schema.ts";
import {
  coachAccolades,
  coachCareerStops,
  coachConnections,
  coachDepthChartNotes,
  coachReputationLabels,
  coachTenureUnitPerformance,
} from "./coach-history.schema.ts";
import { colleges } from "../colleges/college.schema.ts";
import { leagues } from "../league/league.schema.ts";
import { teams } from "../team/team.schema.ts";
import { createCoachesRepository } from "./coaches.repository.ts";

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
  const [team] = await db
    .insert(teams)
    .values({
      name: "Test Team",
      city: "Testville",
      abbreviation: `T${crypto.randomUUID().slice(0, 2).toUpperCase()}`,
      primaryColor: "#000000",
      secondaryColor: "#FFFFFF",
      accentColor: "#FF0000",
      conference: "AFC",
      division: "AFC East",
    })
    .returning();
  return { league, team };
}

Deno.test({
  name: "coachesRepository.getStaffTreeByTeam: returns flat nodes for the team",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createCoachesRepository({
      db,
      log: createTestLogger(),
      now: () => new Date("2030-01-01T00:00:00Z"),
    });
    const created: string[] = [];
    const teamsCreated: string[] = [];
    const leaguesCreated: string[] = [];

    try {
      const { league, team } = await setupFixtures(db);
      leaguesCreated.push(league.id);
      teamsCreated.push(team.id);

      const hcId = crypto.randomUUID();
      const ocId = crypto.randomUUID();
      await db.insert(coaches).values([
        {
          id: hcId,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Head",
          lastName: "Coach",
          role: "HC",
          reportsToId: null,
          playCaller: "offense",
          age: 50,
          hiredAt: new Date("2027-01-01T00:00:00Z"),
          contractYears: 3,
          contractSalary: 10_000_000,
          contractBuyout: 20_000_000,
          specialty: "ceo",
        },
        {
          id: ocId,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Off",
          lastName: "Coord",
          role: "OC",
          reportsToId: hcId,
          age: 45,
          hiredAt: new Date("2028-01-01T00:00:00Z"),
          contractYears: 2,
          contractSalary: 3_000_000,
          contractBuyout: 4_000_000,
          specialty: "offense",
        },
      ]);
      created.push(hcId, ocId);

      const tree = await repo.getStaffTreeByTeam(team.id);
      assertEquals(tree.length, 2);

      const hc = tree.find((c) => c.id === hcId);
      assertEquals(hc?.role, "HC");
      assertEquals(hc?.reportsToId, null);
      assertEquals(hc?.yearsWithTeam, 3);

      const oc = tree.find((c) => c.id === ocId);
      assertEquals(oc?.role, "OC");
      assertEquals(oc?.reportsToId, hcId);
      assertEquals(oc?.yearsWithTeam, 2);
    } finally {
      if (created.length > 0) {
        await db.delete(coaches).where(inArray(coaches.id, created));
      }
      for (const id of teamsCreated) {
        await db.delete(teams).where(eq(teams.id, id));
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
    "coachesRepository.getCoachDetailById: aggregates college, reputation, resume, tenure, accolades, depth-chart notes, and connections",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createCoachesRepository({
      db,
      log: createTestLogger(),
      now: () => new Date("2030-01-01T00:00:00Z"),
    });
    const coachesCreated: string[] = [];
    const teamsCreated: string[] = [];
    const leaguesCreated: string[] = [];

    try {
      const { league, team } = await setupFixtures(db);
      leaguesCreated.push(league.id);
      teamsCreated.push(team.id);

      const [college] = await db
        .select()
        .from(colleges)
        .limit(1);

      const mentorId = crypto.randomUUID();
      const coachId = crypto.randomUUID();
      const peerId = crypto.randomUUID();

      await db.insert(coaches).values([
        {
          id: mentorId,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Mentor",
          lastName: "Sr",
          role: "HC",
          age: 65,
          hiredAt: new Date("2020-01-01T00:00:00Z"),
          contractYears: 1,
          contractSalary: 5_000_000,
          contractBuyout: 0,
        },
        {
          id: coachId,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Under",
          lastName: "Study",
          role: "OC",
          age: 42,
          hiredAt: new Date("2028-01-01T00:00:00Z"),
          contractYears: 2,
          contractSalary: 2_500_000,
          contractBuyout: 3_000_000,
          specialty: "offense",
          collegeId: college?.id,
          mentorCoachId: mentorId,
        },
        {
          id: peerId,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Peer",
          lastName: "Buddy",
          role: "DC",
          age: 43,
          hiredAt: new Date("2028-01-01T00:00:00Z"),
          contractYears: 2,
          contractSalary: 2_500_000,
          contractBuyout: 3_000_000,
        },
      ]);
      coachesCreated.push(mentorId, coachId, peerId);

      await db.insert(coachReputationLabels).values([
        { coachId, label: "offensive innovator" },
        { coachId, label: "players' coach" },
      ]);
      await db.insert(coachCareerStops).values({
        coachId,
        teamName: "State Tech",
        role: "QB Coach",
        startYear: 2018,
        endYear: 2022,
        teamWins: 42,
        teamLosses: 20,
        teamTies: 0,
        unitRank: 7,
        unitSide: "offense",
      });
      await db.insert(coachTenureUnitPerformance).values({
        coachId,
        season: 1,
        unitSide: "offense",
        rank: 3,
        metrics: { runPassSplit: 0.42 },
      });
      await db.insert(coachAccolades).values({
        coachId,
        season: 1,
        type: "coy_vote",
        detail: "finished 3rd in COY voting",
      });
      await db.insert(coachDepthChartNotes).values({
        coachId,
        season: 1,
        note: "started rookie over veteran for last 6 games",
      });
      await db.insert(coachConnections).values({
        coachId,
        otherCoachId: peerId,
        relation: "peer",
      });

      const detail = await repo.getCoachDetailById(coachId);
      assertEquals(detail?.id, coachId);
      assertEquals(detail?.yearsWithTeam, 2);
      assertEquals(detail?.mentor?.id, mentorId);
      assertEquals(detail?.college?.id, college?.id);
      assertEquals(detail?.reputationLabels.length, 2);
      assertEquals(detail?.careerStops.length, 1);
      assertEquals(detail?.careerStops[0].teamName, "State Tech");
      assertEquals(detail?.tenureUnitPerformance.length, 1);
      assertEquals(detail?.accolades.length, 1);
      assertEquals(detail?.depthChartNotes.length, 1);
      assertEquals(detail?.connections.length, 1);
      assertEquals(detail?.connections[0].coach.id, peerId);
    } finally {
      if (coachesCreated.length > 0) {
        await db.delete(coaches).where(inArray(coaches.id, coachesCreated));
      }
      for (const id of teamsCreated) {
        await db.delete(teams).where(eq(teams.id, id));
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
    "coachesRepository.getCoachDetailById: returns undefined when not found",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createCoachesRepository({ db, log: createTestLogger() });
    try {
      const result = await repo.getCoachDetailById(crypto.randomUUID());
      assertEquals(result, undefined);
    } finally {
      await client.end();
    }
  },
});
