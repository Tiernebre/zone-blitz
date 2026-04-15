import { assertEquals, assertRejects } from "@std/assert";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import pino from "pino";
import {
  DomainError,
  type NeutralBucket,
  PLAYER_ATTRIBUTE_KEYS,
} from "@zone-blitz/shared";
import * as schema from "../../db/schema.ts";
import { players } from "../players/player.schema.ts";
import { playerAttributes } from "../players/attributes.schema.ts";
import { contracts } from "../contracts/contract.schema.ts";
import { depthChartEntries } from "../players/depth-chart.schema.ts";
import {
  BUCKET_PROFILES,
  stubAttributesFor,
} from "../players/players-generator.ts";
import { coaches } from "../coaches/coach.schema.ts";
import { coachTendencies } from "../coaches/coach-tendencies.schema.ts";
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

function stubAttributeColumns(
  bucket: NeutralBucket = "QB",
): Record<string, number> {
  const attrs = stubAttributesFor(bucket);
  const row: Record<string, number> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    row[key] = attrs[key];
    row[`${key}Potential`] = attrs[`${key}Potential`];
  }
  return row;
}

function sizeFor(bucket: NeutralBucket) {
  return {
    heightInches: BUCKET_PROFILES[bucket].heightInches,
    weightPounds: BUCKET_PROFILES[bucket].weightPounds,
  };
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
      const idlId = crypto.randomUUID();
      await db.insert(players).values([
        {
          id: qbId,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Sam",
          lastName: "Stone",
          injuryStatus: "healthy",
          ...sizeFor("QB"),
          birthDate: "2000-01-01",
        },
        {
          id: idlId,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Dan",
          lastName: "Line",
          injuryStatus: "questionable",
          ...sizeFor("IDL"),
          birthDate: "1998-08-01",
        },
      ]);
      playersCreated.push(qbId, idlId);

      await db.insert(playerAttributes).values([
        { playerId: qbId, ...stubAttributeColumns("QB") },
        { playerId: idlId, ...stubAttributeColumns("IDL") },
      ]);

      await db.insert(contracts).values([
        {
          playerId: qbId,
          teamId: team.id,
          signedYear: 2029,
          totalYears: 4,
          realYears: 4,
          signingBonus: 5_000_000,
        },
        {
          playerId: idlId,
          teamId: team.id,
          signedYear: 2030,
          totalYears: 3,
          realYears: 3,
          signingBonus: 0,
        },
      ]);

      const roster = await repo.getActiveRoster(league.id, team.id);

      assertEquals(roster.leagueId, league.id);
      assertEquals(roster.teamId, team.id);
      assertEquals(roster.players.length, 2);

      const qb = roster.players.find((p) => p.id === qbId);
      assertEquals(qb?.neutralBucket, "QB");
      assertEquals(qb?.neutralBucketGroup, "offense");
      assertEquals(qb?.contractYearsRemaining, 4);
      assertEquals(qb?.age, 30);
      assertEquals(qb?.injuryStatus, "healthy");

      const idl = roster.players.find((p) => p.id === idlId);
      assertEquals(idl?.neutralBucket, "IDL");
      assertEquals(idl?.neutralBucketGroup, "defense");
      assertEquals(idl?.contractYearsRemaining, 3);
      assertEquals(idl?.injuryStatus, "questionable");

      // No coaches hired → no scheme to fit against → null per ADR 0005.
      assertEquals(qb?.schemeFit, null);
      assertEquals(idl?.schemeFit, null);
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
    "rosterRepository.getActiveRoster: surfaces a qualitative schemeFit once a DC is hired with tendencies",
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
    const coachesCreated: string[] = [];

    try {
      const { league, team, state, city } = await setupFixtures(db);
      leaguesCreated.push(league.id);
      teamsCreated.push(team.id);
      citiesCreated.push(city.id);
      statesCreated.push(state.id);

      const cbId = crypto.randomUUID();
      await db.insert(players).values({
        id: cbId,
        leagueId: league.id,
        teamId: team.id,
        firstName: "Corey",
        lastName: "Corner",
        injuryStatus: "healthy",
        ...sizeFor("CB"),
        birthDate: "2000-01-01",
      });
      playersCreated.push(cbId);
      await db.insert(playerAttributes).values({
        playerId: cbId,
        ...stubAttributeColumns("CB"),
      });

      const dcId = crypto.randomUUID();
      await db.insert(coaches).values({
        id: dcId,
        leagueId: league.id,
        teamId: team.id,
        firstName: "Deanna",
        lastName: "Coordinator",
        role: "DC",
        age: 48,
        hiredAt: new Date("2028-01-01T00:00:00Z"),
        contractYears: 3,
        contractSalary: 1,
        contractBuyout: 1,
      });
      coachesCreated.push(dcId);

      // Full press-man / man-coverage tilt so CB archetype weights have
      // polarized axes to score against.
      await db.insert(coachTendencies).values({
        coachId: dcId,
        frontOddEven: 50,
        gapResponsibility: 50,
        subPackageLean: 50,
        coverageManZone: 10,
        coverageShell: 50,
        cornerPressOff: 10,
        pressureRate: 50,
        disguiseRate: 50,
      });

      const roster = await repo.getActiveRoster(league.id, team.id);
      const cb = roster.players.find((p) => p.id === cbId);
      assertEquals(cb?.neutralBucket, "CB");
      // Hired DC + polarized axes → fit must be a qualitative label, not null.
      if (cb?.schemeFit === null || cb?.schemeFit === undefined) {
        throw new Error("expected non-null schemeFit once a DC is hired");
      }
      assertEquals(
        ["ideal", "fits", "neutral", "poor", "miscast"].includes(cb.schemeFit),
        true,
      );
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
    "rosterRepository.getActiveRoster: attaches depthChartSlot from the authored depth chart",
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
    const coachesCreated: string[] = [];

    try {
      const { league, team, state, city } = await setupFixtures(db);
      leaguesCreated.push(league.id);
      teamsCreated.push(team.id);
      citiesCreated.push(city.id);
      statesCreated.push(state.id);

      const slottedId = crypto.randomUUID();
      const unslottedId = crypto.randomUUID();
      await db.insert(players).values([
        {
          id: slottedId,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Sam",
          lastName: "Slotted",
          injuryStatus: "healthy",
          ...sizeFor("QB"),
          birthDate: "2000-01-01",
        },
        {
          id: unslottedId,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Una",
          lastName: "Unslotted",
          injuryStatus: "healthy",
          ...sizeFor("RB"),
          birthDate: "2001-01-01",
        },
      ]);
      playersCreated.push(slottedId, unslottedId);

      await db.insert(playerAttributes).values([
        { playerId: slottedId, ...stubAttributeColumns("QB") },
        { playerId: unslottedId, ...stubAttributeColumns("RB") },
      ]);

      const coachId = crypto.randomUUID();
      await db.insert(coaches).values({
        id: coachId,
        leagueId: league.id,
        teamId: team.id,
        firstName: "Hank",
        lastName: "Coach",
        role: "HC",
        age: 50,
        hiredAt: new Date("2028-01-01T00:00:00Z"),
        contractYears: 3,
        contractSalary: 1,
        contractBuyout: 1,
      });
      coachesCreated.push(coachId);

      await db.insert(depthChartEntries).values({
        teamId: team.id,
        playerId: slottedId,
        slotCode: "QB1",
        slotOrdinal: 1,
        isInactive: false,
        publishedByCoachId: coachId,
      });

      const roster = await repo.getActiveRoster(league.id, team.id);

      const slotted = roster.players.find((p) => p.id === slottedId);
      assertEquals(slotted?.depthChartSlot, "QB1");

      const unslotted = roster.players.find((p) => p.id === unslottedId);
      assertEquals(unslotted?.depthChartSlot, null);
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
          injuryStatus: "healthy",
          ...sizeFor("QB"),
          birthDate: "2000-01-01",
        },
        {
          id: inactiveId,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Ben",
          lastName: "Bench",
          injuryStatus: "out",
          ...sizeFor("RB"),
          birthDate: "2001-01-01",
        },
      ]);
      playersCreated.push(starterId, inactiveId);

      await db.insert(playerAttributes).values([
        { playerId: starterId, ...stubAttributeColumns("QB") },
        { playerId: inactiveId, ...stubAttributeColumns("RB") },
      ]);

      await db.insert(depthChartEntries).values([
        {
          teamId: team.id,
          playerId: starterId,
          slotCode: "QB",
          slotOrdinal: 1,
          isInactive: false,
          publishedByCoachId: coachId,
        },
        {
          teamId: team.id,
          playerId: inactiveId,
          slotCode: "RB",
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
      assertEquals(Array.isArray(chart.vocabulary), true);
      assertEquals(chart.vocabulary.length > 0, true);
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
      assertEquals(Array.isArray(chart.vocabulary), true);
      assertEquals(chart.vocabulary.length > 0, true);
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
