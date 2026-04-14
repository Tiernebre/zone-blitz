import { assertEquals } from "@std/assert";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import pino from "pino";
import * as schema from "../../db/schema.ts";
import { players } from "./player.schema.ts";
import { contracts } from "./contract.schema.ts";
import { contractHistory } from "./contract-history.schema.ts";
import { playerTransactions } from "./player-transaction.schema.ts";
import { playerSeasonStats } from "./player-career-log.schema.ts";
import { playerAccolades } from "./player-accolades.schema.ts";
import { leagues } from "../league/league.schema.ts";
import { teams } from "../team/team.schema.ts";
import { cities } from "../cities/city.schema.ts";
import { states } from "../states/state.schema.ts";
import { createPlayersRepository } from "./players.repository.ts";

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
      code: `t-${crypto.randomUUID().slice(0, 6)}`,
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
      name: "Bengals",
      cityId: city.id,
      abbreviation: `T${crypto.randomUUID().slice(0, 2).toUpperCase()}`,
      primaryColor: "#000000",
      secondaryColor: "#FFFFFF",
      accentColor: "#FF0000",
      conference: "AFC",
      division: "AFC North",
    })
    .returning();
  return { league, team, state, city };
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
    "playersRepository.getDetailById: returns header and origin for a drafted player",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createPlayersRepository({
      db,
      log: createTestLogger(),
      now: () => new Date("2026-06-15T00:00:00Z"),
    });
    const playersCreated: string[] = [];
    const teamsCreated: string[] = [];
    const leaguesCreated: string[] = [];
    const citiesCreated: string[] = [];
    const statesCreated: string[] = [];

    try {
      const { league, team, city, state } = await setupFixtures(db);
      leaguesCreated.push(league.id);
      teamsCreated.push(team.id);
      citiesCreated.push(city.id);
      statesCreated.push(state.id);

      const playerId = crypto.randomUUID();
      await db.insert(players).values({
        id: playerId,
        leagueId: league.id,
        teamId: team.id,
        firstName: "Sam",
        lastName: "Stone",
        position: "QB",
        injuryStatus: "healthy",
        heightInches: 74,
        weightPounds: 225,
        college: "State University",
        hometown: "Dallas, TX",
        birthDate: "2000-03-10",
        draftYear: 2022,
        draftRound: 1,
        draftPick: 3,
        draftingTeamId: team.id,
      });
      playersCreated.push(playerId);

      const detail = await repo.getDetailById(playerId);
      assertEquals(detail?.firstName, "Sam");
      assertEquals(detail?.lastName, "Stone");
      assertEquals(detail?.position, "QB");
      assertEquals(detail?.age, 26);
      assertEquals(detail?.yearsOfExperience, 4);
      assertEquals(detail?.currentTeam?.name, "Bengals");
      assertEquals(detail?.origin.draftYear, 2022);
      assertEquals(detail?.origin.draftRound, 1);
      assertEquals(detail?.origin.draftPick, 3);
      assertEquals(detail?.origin.draftingTeam?.name, "Bengals");
      assertEquals(detail?.origin.college, "State University");
      assertEquals(detail?.origin.hometown, "Dallas, TX");
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
    "playersRepository.getDetailById: undrafted free agent has no team and no draft info",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createPlayersRepository({
      db,
      log: createTestLogger(),
      now: () => new Date("2026-06-15T00:00:00Z"),
    });
    const playersCreated: string[] = [];
    const leaguesCreated: string[] = [];
    const citiesCreated: string[] = [];
    const statesCreated: string[] = [];
    const teamsCreated: string[] = [];

    try {
      const { league, team, city, state } = await setupFixtures(db);
      leaguesCreated.push(league.id);
      citiesCreated.push(city.id);
      statesCreated.push(state.id);
      teamsCreated.push(team.id);

      const playerId = crypto.randomUUID();
      await db.insert(players).values({
        id: playerId,
        leagueId: league.id,
        teamId: null,
        firstName: "Jake",
        lastName: "Journeyman",
        position: "WR",
        injuryStatus: "healthy",
        heightInches: 72,
        weightPounds: 200,
        college: null,
        hometown: null,
        birthDate: "1998-08-01",
        draftYear: null,
        draftRound: null,
        draftPick: null,
        draftingTeamId: null,
      });
      playersCreated.push(playerId);

      const detail = await repo.getDetailById(playerId);
      assertEquals(detail?.currentTeam, null);
      assertEquals(detail?.yearsOfExperience, 0);
      assertEquals(detail?.origin.draftYear, null);
      assertEquals(detail?.origin.draftingTeam, null);
      assertEquals(detail?.origin.college, null);
      assertEquals(detail?.origin.hometown, null);
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
    "playersRepository.getDetailById: surfaces current contract + contract history",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createPlayersRepository({
      db,
      log: createTestLogger(),
      now: () => new Date("2026-06-15T00:00:00Z"),
    });
    const playersCreated: string[] = [];
    const leaguesCreated: string[] = [];
    const citiesCreated: string[] = [];
    const statesCreated: string[] = [];
    const teamsCreated: string[] = [];

    try {
      const { league, team, city, state } = await setupFixtures(db);
      leaguesCreated.push(league.id);
      citiesCreated.push(city.id);
      statesCreated.push(state.id);
      teamsCreated.push(team.id);

      const playerId = crypto.randomUUID();
      await db.insert(players).values({
        id: playerId,
        leagueId: league.id,
        teamId: team.id,
        firstName: "Sam",
        lastName: "Stone",
        position: "QB",
        injuryStatus: "healthy",
        heightInches: 74,
        weightPounds: 225,
        college: "State University",
        hometown: "Dallas, TX",
        birthDate: "2000-03-10",
        draftYear: 2022,
        draftRound: 1,
        draftPick: 3,
        draftingTeamId: team.id,
      });
      playersCreated.push(playerId);

      await db.insert(contracts).values({
        playerId,
        teamId: team.id,
        totalYears: 4,
        currentYear: 2,
        totalSalary: 80_000_000,
        annualSalary: 20_000_000,
        guaranteedMoney: 40_000_000,
        signingBonus: 10_000_000,
      });

      await db.insert(contractHistory).values([
        {
          playerId,
          teamId: team.id,
          signedInYear: 2022,
          totalYears: 4,
          totalSalary: 16_000_000,
          guaranteedMoney: 8_000_000,
          terminationReason: "expired",
          endedInYear: 2025,
        },
        {
          playerId,
          teamId: team.id,
          signedInYear: 2025,
          totalYears: 4,
          totalSalary: 80_000_000,
          guaranteedMoney: 40_000_000,
          terminationReason: "active",
          endedInYear: null,
        },
      ]);

      const detail = await repo.getDetailById(playerId);
      assertEquals(detail?.currentContract?.totalYears, 4);
      assertEquals(detail?.currentContract?.currentYear, 2);
      assertEquals(detail?.currentContract?.yearsRemaining, 3);
      assertEquals(detail?.currentContract?.annualSalary, 20_000_000);
      assertEquals(detail?.contractHistory.length, 2);
      assertEquals(detail?.contractHistory[0].signedInYear, 2022);
      assertEquals(detail?.contractHistory[0].terminationReason, "expired");
      assertEquals(detail?.contractHistory[1].terminationReason, "active");
      assertEquals(detail?.contractHistory[1].team.name, "Bengals");
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
    "playersRepository.getDetailById: surfaces the chronological transaction log",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createPlayersRepository({
      db,
      log: createTestLogger(),
      now: () => new Date("2026-06-15T00:00:00Z"),
    });
    const playersCreated: string[] = [];
    const leaguesCreated: string[] = [];
    const citiesCreated: string[] = [];
    const statesCreated: string[] = [];
    const teamsCreated: string[] = [];

    try {
      const { league, team, city, state } = await setupFixtures(db);
      leaguesCreated.push(league.id);
      citiesCreated.push(city.id);
      statesCreated.push(state.id);
      teamsCreated.push(team.id);

      const playerId = crypto.randomUUID();
      await db.insert(players).values({
        id: playerId,
        leagueId: league.id,
        teamId: team.id,
        firstName: "Sam",
        lastName: "Stone",
        position: "QB",
        injuryStatus: "healthy",
        heightInches: 74,
        weightPounds: 225,
        college: "State University",
        hometown: "Dallas, TX",
        birthDate: "2000-03-10",
        draftYear: 2022,
        draftRound: 1,
        draftPick: 3,
        draftingTeamId: team.id,
      });
      playersCreated.push(playerId);

      await db.insert(playerTransactions).values([
        {
          playerId,
          teamId: team.id,
          type: "drafted",
          seasonYear: 2022,
          detail: "Round 1, pick 3 overall",
        },
        {
          playerId,
          teamId: team.id,
          type: "extended",
          seasonYear: 2025,
          detail: "4-year extension",
        },
      ]);

      const detail = await repo.getDetailById(playerId);
      assertEquals(detail?.transactions.length, 2);
      assertEquals(detail?.transactions[0].type, "drafted");
      assertEquals(
        detail?.transactions[0].team?.abbreviation,
        team.abbreviation,
      );
      assertEquals(detail?.transactions[1].type, "extended");
      assertEquals(detail?.transactions[1].counterpartyTeam, null);
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
    "playersRepository.getDetailById: returns the career log and accolade list",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createPlayersRepository({
      db,
      log: createTestLogger(),
      now: () => new Date("2026-06-15T00:00:00Z"),
    });
    const playersCreated: string[] = [];
    const leaguesCreated: string[] = [];
    const citiesCreated: string[] = [];
    const statesCreated: string[] = [];
    const teamsCreated: string[] = [];

    try {
      const { league, team, city, state } = await setupFixtures(db);
      leaguesCreated.push(league.id);
      citiesCreated.push(city.id);
      statesCreated.push(state.id);
      teamsCreated.push(team.id);

      const playerId = crypto.randomUUID();
      await db.insert(players).values({
        id: playerId,
        leagueId: league.id,
        teamId: team.id,
        firstName: "Sam",
        lastName: "Stone",
        position: "QB",
        injuryStatus: "healthy",
        heightInches: 74,
        weightPounds: 225,
        college: "State University",
        hometown: "Dallas, TX",
        birthDate: "2000-03-10",
        draftYear: 2022,
        draftRound: 1,
        draftPick: 3,
        draftingTeamId: team.id,
      });
      playersCreated.push(playerId);

      await db.insert(playerSeasonStats).values([
        {
          playerId,
          teamId: team.id,
          seasonYear: 2024,
          playoffs: false,
          gamesPlayed: 17,
          gamesStarted: 17,
          stats: { passingYards: 4200, passingTouchdowns: 32 },
        },
        {
          playerId,
          teamId: team.id,
          seasonYear: 2024,
          playoffs: true,
          gamesPlayed: 2,
          gamesStarted: 2,
          stats: { passingYards: 480, passingTouchdowns: 4 },
        },
      ]);

      await db.insert(playerAccolades).values([
        {
          playerId,
          seasonYear: 2024,
          type: "pro_bowl",
          detail: null,
        },
        {
          playerId,
          seasonYear: 2024,
          type: "statistical_milestone",
          detail: "4,000+ passing yards",
        },
      ]);

      const detail = await repo.getDetailById(playerId);
      assertEquals(detail?.seasonStats.length, 2);
      assertEquals(detail?.seasonStats[0].gamesPlayed, 17);
      assertEquals(
        (detail?.seasonStats[0].stats as Record<string, number>)
          .passingTouchdowns,
        32,
      );
      assertEquals(detail?.seasonStats[1].playoffs, true);
      assertEquals(detail?.accolades.length, 2);
      assertEquals(detail?.accolades[0].type, "pro_bowl");
      assertEquals(detail?.accolades[1].detail, "4,000+ passing yards");
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
  name: "playersRepository.getDetailById: returns undefined for unknown id",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createPlayersRepository({ db, log: createTestLogger() });
    try {
      const detail = await repo.getDetailById(crypto.randomUUID());
      assertEquals(detail, undefined);
    } finally {
      await client.end();
    }
  },
});
