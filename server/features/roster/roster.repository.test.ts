import { assertEquals, assertRejects } from "@std/assert";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import pino from "pino";
import { DomainError, PLAYER_ATTRIBUTE_KEYS } from "@zone-blitz/shared";
import * as schema from "../../db/schema.ts";
import { players } from "../players/player.schema.ts";
import { playerAttributes } from "../players/attributes.schema.ts";
import { contracts } from "../contracts/contract.schema.ts";
import { depthChartEntries } from "../players/depth-chart.schema.ts";
import { coaches } from "../coaches/coach.schema.ts";
import { leagues } from "../league/league.schema.ts";
import { teams } from "../team/team.schema.ts";
import { cities } from "../cities/city.schema.ts";
import { states } from "../states/state.schema.ts";
import { createRosterRepository } from "./roster.repository.ts";

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

function stubAttributeColumns(): Record<string, number> {
  const row: Record<string, number> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    row[key] = 50;
    row[`${key}Potential`] = 60;
  }
  return row;
}

async function cleanup(
  db: ReturnType<typeof createTestDb>["db"],
  ids: {
    players?: string[];
    teams?: string[];
    cities?: string[];
    states?: string[];
    leagues?: string[];
  },
) {
  if (ids.players?.length) {
    await db.delete(players).where(inArray(players.id, ids.players));
  }
  for (const id of ids.teams ?? []) {
    await db.delete(teams).where(eq(teams.id, id));
  }
  for (const id of ids.cities ?? []) {
    await db.delete(cities).where(eq(cities.id, id));
  }
  for (const id of ids.states ?? []) {
    await db.delete(states).where(eq(states.id, id));
  }
  for (const id of ids.leagues ?? []) {
    await db.delete(leagues).where(eq(leagues.id, id));
  }
}

Deno.test({
  name:
    "rosterRepository.getActiveRoster: returns players with cap, age, and contract years",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createRosterRepository({
      db,
      log: createTestLogger(),
      now: () => new Date("2030-06-15T00:00:00Z"),
    });
    const playersCreated: string[] = [];
    const teamsCreated: string[] = [];
    const leaguesCreated: string[] = [];
    const citiesCreated: string[] = [];
    const statesCreated: string[] = [];

    try {
      const { league, team, state, city } = await setupFixtures(db);
      leaguesCreated.push(league.id);
      teamsCreated.push(team.id);
      citiesCreated.push(city.id);
      statesCreated.push(state.id);

      const qbId = crypto.randomUUID();
      const dlId = crypto.randomUUID();
      await db.insert(players).values([
        {
          id: qbId,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Sam",
          lastName: "Stone",
          position: "QB",
          injuryStatus: "healthy",
          heightInches: 75,
          weightPounds: 220,
          birthDate: "2000-01-01",
        },
        {
          id: dlId,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Dan",
          lastName: "Line",
          position: "DL",
          injuryStatus: "questionable",
          heightInches: 76,
          weightPounds: 280,
          birthDate: "1998-08-01",
        },
      ]);
      playersCreated.push(qbId, dlId);

      await db.insert(playerAttributes).values([
        { playerId: qbId, ...stubAttributeColumns() },
        { playerId: dlId, ...stubAttributeColumns() },
      ]);

      await db.insert(contracts).values([
        {
          playerId: qbId,
          teamId: team.id,
          totalYears: 4,
          currentYear: 2,
          totalSalary: 40_000_000,
          annualSalary: 10_000_000,
          guaranteedMoney: 20_000_000,
          signingBonus: 5_000_000,
        },
        {
          playerId: dlId,
          teamId: team.id,
          totalYears: 3,
          currentYear: 1,
          totalSalary: 15_000_000,
          annualSalary: 5_000_000,
          guaranteedMoney: 5_000_000,
          signingBonus: 0,
        },
      ]);

      const roster = await repo.getActiveRoster(league.id, team.id);

      assertEquals(roster.leagueId, league.id);
      assertEquals(roster.teamId, team.id);
      assertEquals(roster.players.length, 2);
      assertEquals(roster.totalCap, 15_000_000);
      assertEquals(roster.salaryCap, 255_000_000);
      assertEquals(roster.capSpace, 240_000_000);

      const qb = roster.players.find((p) => p.id === qbId);
      assertEquals(qb?.position, "QB");
      assertEquals(qb?.positionGroup, "offense");
      assertEquals(qb?.capHit, 10_000_000);
      assertEquals(qb?.contractYearsRemaining, 3);
      assertEquals(qb?.age, 30);
      assertEquals(qb?.injuryStatus, "healthy");

      const dl = roster.players.find((p) => p.id === dlId);
      assertEquals(dl?.positionGroup, "defense");
      assertEquals(dl?.injuryStatus, "questionable");

      const offense = roster.positionGroups.find((g) => g.group === "offense");
      assertEquals(offense?.headcount, 1);
      assertEquals(offense?.totalCap, 10_000_000);
      const defense = roster.positionGroups.find((g) => g.group === "defense");
      assertEquals(defense?.headcount, 1);
      assertEquals(defense?.totalCap, 5_000_000);
      const st = roster.positionGroups.find((g) => g.group === "special_teams");
      assertEquals(st?.headcount, 0);
    } finally {
      await cleanup(db, {
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
    "rosterRepository.getActiveRoster: throws NOT_FOUND when league missing",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createRosterRepository({ db, log: createTestLogger() });
    try {
      await assertRejects(
        () => repo.getActiveRoster(crypto.randomUUID(), crypto.randomUUID()),
        DomainError,
      );
    } finally {
      await client.end();
    }
  },
});

Deno.test({
  name:
    "rosterRepository.getDepthChart: returns slots, inactives, and latest publisher",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createRosterRepository({ db, log: createTestLogger() });
    const playersCreated: string[] = [];
    const teamsCreated: string[] = [];
    const leaguesCreated: string[] = [];
    const citiesCreated: string[] = [];
    const statesCreated: string[] = [];
    const coachesCreated: string[] = [];

    try {
      const { league, team, state, city } = await setupFixtures(db);
      leaguesCreated.push(league.id);
      teamsCreated.push(team.id);
      citiesCreated.push(city.id);
      statesCreated.push(state.id);

      const coachId = crypto.randomUUID();
      await db.insert(coaches).values({
        id: coachId,
        leagueId: league.id,
        teamId: team.id,
        firstName: "Alex",
        lastName: "Stone",
        role: "HC",
        age: 50,
        hiredAt: new Date("2028-01-01T00:00:00Z"),
        contractYears: 3,
        contractSalary: 1,
        contractBuyout: 1,
      });
      coachesCreated.push(coachId);

      const starterId = crypto.randomUUID();
      const inactiveId = crypto.randomUUID();
      await db.insert(players).values([
        {
          id: starterId,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Sam",
          lastName: "Stone",
          position: "QB",
          injuryStatus: "healthy",
          heightInches: 75,
          weightPounds: 220,
          birthDate: "2000-01-01",
        },
        {
          id: inactiveId,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Ben",
          lastName: "Bench",
          position: "RB",
          injuryStatus: "out",
          heightInches: 70,
          weightPounds: 210,
          birthDate: "2001-01-01",
        },
      ]);
      playersCreated.push(starterId, inactiveId);

      await db.insert(playerAttributes).values([
        { playerId: starterId, ...stubAttributeColumns() },
        { playerId: inactiveId, ...stubAttributeColumns() },
      ]);

      await db.insert(depthChartEntries).values([
        {
          teamId: team.id,
          playerId: starterId,
          position: "QB",
          slotOrdinal: 1,
          isInactive: false,
          publishedByCoachId: coachId,
        },
        {
          teamId: team.id,
          playerId: inactiveId,
          position: "RB",
          slotOrdinal: 1,
          isInactive: true,
          publishedByCoachId: coachId,
        },
      ]);

      const chart = await repo.getDepthChart(league.id, team.id);
      assertEquals(chart.slots.length, 1);
      assertEquals(chart.slots[0].playerId, starterId);
      assertEquals(chart.slots[0].slotOrdinal, 1);
      assertEquals(chart.inactives.length, 1);
      assertEquals(chart.inactives[0].playerId, inactiveId);
      assertEquals(chart.lastUpdatedBy?.id, coachId);
      assertEquals(typeof chart.lastUpdatedAt, "string");
    } finally {
      if (coachesCreated.length) {
        await db.delete(coaches).where(inArray(coaches.id, coachesCreated));
      }
      await cleanup(db, {
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
    "rosterRepository.getDepthChart: returns empty chart when no entries exist",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createRosterRepository({ db, log: createTestLogger() });
    const teamsCreated: string[] = [];
    const leaguesCreated: string[] = [];
    const citiesCreated: string[] = [];
    const statesCreated: string[] = [];
    try {
      const { league, team, state, city } = await setupFixtures(db);
      leaguesCreated.push(league.id);
      teamsCreated.push(team.id);
      citiesCreated.push(city.id);
      statesCreated.push(state.id);

      const chart = await repo.getDepthChart(league.id, team.id);
      assertEquals(chart.slots, []);
      assertEquals(chart.inactives, []);
      assertEquals(chart.lastUpdatedAt, null);
      assertEquals(chart.lastUpdatedBy, null);
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

Deno.test({
  name: "rosterRepository.getStatistics: returns empty rows (stub)",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createRosterRepository({ db, log: createTestLogger() });
    try {
      const stats = await repo.getStatistics("lg-1", "tm-1", "season-1");
      assertEquals(stats.rows, []);
      assertEquals(stats.seasonId, "season-1");

      const statsNoSeason = await repo.getStatistics("lg-1", "tm-1", null);
      assertEquals(statsNoSeason.seasonId, null);
    } finally {
      await client.end();
    }
  },
});
