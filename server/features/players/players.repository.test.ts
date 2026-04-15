import { assertEquals } from "@std/assert";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import pino from "pino";
import * as schema from "../../db/schema.ts";
import { players } from "./player.schema.ts";
import { contracts } from "../contracts/contract.schema.ts";
import { contractHistory } from "../contracts/contract-history.schema.ts";
import { playerTransactions } from "../contracts/player-transaction.schema.ts";
import { playerAttributes } from "./attributes.schema.ts";
import { playerDraftProfile } from "./player-draft-profile.schema.ts";
import { playerSeasonStats } from "./player-career-log.schema.ts";
import { playerAccolades } from "./player-accolades.schema.ts";
import { leagues } from "../league/league.schema.ts";
import { teams } from "../team/team.schema.ts";
import { cities } from "../cities/city.schema.ts";
import { states } from "../states/state.schema.ts";
import { seasons } from "../season/season.schema.ts";
import { type NeutralBucket, PLAYER_ATTRIBUTE_KEYS } from "@zone-blitz/shared";
import { createPlayersRepository } from "./players.repository.ts";
import { BUCKET_PROFILES, stubAttributesFor } from "./players-generator.ts";

function attributesForBucket(
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
        injuryStatus: "healthy",
        ...sizeFor("QB"),
        college: "State University",
        hometown: "Dallas, TX",
        birthDate: "2000-03-10",
        draftYear: 2022,
        draftRound: 1,
        draftPick: 3,
        draftingTeamId: team.id,
      });
      playersCreated.push(playerId);
      await db.insert(playerAttributes).values({
        playerId,
        ...attributesForBucket("QB"),
      });

      const detail = await repo.getDetailById(playerId);
      assertEquals(detail?.firstName, "Sam");
      assertEquals(detail?.lastName, "Stone");
      assertEquals(detail?.neutralBucket, "QB");
      assertEquals(detail?.age, 26);
      assertEquals(detail?.yearsOfExperience, 4);
      assertEquals(detail?.currentTeam?.name, "Bengals");
      assertEquals(detail?.origin.draftYear, 2022);
      assertEquals(detail?.origin.draftRound, 1);
      assertEquals(detail?.origin.draftPick, 3);
      assertEquals(detail?.origin.draftingTeam?.name, "Bengals");
      assertEquals(detail?.origin.college, "State University");
      assertEquals(detail?.origin.hometown, "Dallas, TX");
      assertEquals(detail?.preDraftEvaluation, null);
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
        injuryStatus: "healthy",
        ...sizeFor("WR"),
        college: null,
        hometown: null,
        birthDate: "1998-08-01",
        draftYear: null,
        draftRound: null,
        draftPick: null,
        draftingTeamId: null,
      });
      playersCreated.push(playerId);
      await db.insert(playerAttributes).values({
        playerId,
        ...attributesForBucket("WR"),
      });

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
        injuryStatus: "healthy",
        ...sizeFor("QB"),
        college: "State University",
        hometown: "Dallas, TX",
        birthDate: "2000-03-10",
        draftYear: 2022,
        draftRound: 1,
        draftPick: 3,
        draftingTeamId: team.id,
      });
      playersCreated.push(playerId);
      await db.insert(playerAttributes).values({
        playerId,
        ...attributesForBucket("QB"),
      });

      await db.insert(contracts).values({
        playerId,
        teamId: team.id,
        signedYear: 2025,
        totalYears: 4,
        realYears: 4,
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
      assertEquals(detail?.currentContract?.realYears, 4);
      assertEquals(detail?.currentContract?.signedYear, 2025);
      assertEquals(detail?.currentContract?.signingBonus, 10_000_000);
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
    "playersRepository.getDetailById: builds a contract ledger with year-by-year breakdown",
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
        injuryStatus: "healthy",
        ...sizeFor("QB"),
        birthDate: "2000-03-10",
        draftYear: 2022,
        draftRound: 1,
        draftPick: 3,
        draftingTeamId: team.id,
      });
      playersCreated.push(playerId);
      await db.insert(playerAttributes).values({
        playerId,
        ...attributesForBucket("QB"),
      });

      await db.insert(contracts).values({
        playerId,
        teamId: team.id,
        signedYear: 2025,
        totalYears: 4,
        realYears: 4,
        signingBonus: 4_000_000,
        isRookieDeal: true,
      });

      await db.insert(contractHistory).values({
        playerId,
        teamId: team.id,
        contractType: "rookie_scale",
        signedInYear: 2022,
        totalYears: 3,
        totalSalary: 6_000_000,
        guaranteedMoney: 3_000_000,
        signingBonus: 1_500_000,
        terminationReason: "expired",
        endedInYear: 2024,
      });

      const detail = await repo.getDetailById(playerId);
      const ledger = detail?.contractLedger;
      assertEquals(ledger?.length, 2);

      const current = ledger![0];
      assertEquals(current.isCurrent, true);
      assertEquals(current.contractType, "rookie_scale");
      assertEquals(current.signedInYear, 2025);
      assertEquals(current.totalYears, 4);
      assertEquals(current.signingBonus, 4_000_000);
      assertEquals(current.team.name, "Bengals");

      const prior = ledger![1];
      assertEquals(prior.isCurrent, false);
      assertEquals(prior.contractType, "rookie_scale");
      assertEquals(prior.signedInYear, 2022);
      assertEquals(prior.totalYears, 3);
      assertEquals(prior.years.length, 3);
      assertEquals(prior.terminationReason, "expired");
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
    "playersRepository.getDetailById: surfaces the reverse-chronological transaction log",
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
        injuryStatus: "healthy",
        ...sizeFor("QB"),
        college: "State University",
        hometown: "Dallas, TX",
        birthDate: "2000-03-10",
        draftYear: 2022,
        draftRound: 1,
        draftPick: 3,
        draftingTeamId: team.id,
      });
      playersCreated.push(playerId);
      await db.insert(playerAttributes).values({
        playerId,
        ...attributesForBucket("QB"),
      });

      await db.insert(playerTransactions).values([
        {
          playerId,
          teamId: team.id,
          type: "drafted",
          seasonYear: 2022,
          occurredAt: new Date("2022-04-28T20:00:00Z"),
          detail: "Round 1, pick 3 overall",
        },
        {
          playerId,
          teamId: team.id,
          type: "extended",
          seasonYear: 2025,
          occurredAt: new Date("2025-08-01T15:00:00Z"),
          detail: "4-year extension",
        },
      ]);

      const detail = await repo.getDetailById(playerId);
      assertEquals(detail?.transactions.length, 2);
      assertEquals(detail?.transactions[0].type, "extended");
      assertEquals(detail?.transactions[0].tradeId, null);
      assertEquals(detail?.transactions[0].counterpartyPlayer, null);
      assertEquals(detail?.transactions[1].type, "drafted");
      assertEquals(
        detail?.transactions[1].team?.abbreviation,
        team.abbreviation,
      );
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
    "playersRepository.getDetailById: two-sided trade links both players via shared tradeId",
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

      const [state2] = await db
        .insert(states)
        .values({
          code: `t-${crypto.randomUUID().slice(0, 6)}`,
          name: `TestState2-${crypto.randomUUID()}`,
          region: "East",
        })
        .returning();
      statesCreated.push(state2.id);
      const [city2] = await db
        .insert(cities)
        .values({
          name: `TestCity2-${crypto.randomUUID()}`,
          stateId: state2.id,
        })
        .returning();
      citiesCreated.push(city2.id);
      const [team2] = await db
        .insert(teams)
        .values({
          name: "Eagles",
          cityId: city2.id,
          abbreviation: `E${crypto.randomUUID().slice(0, 2).toUpperCase()}`,
          primaryColor: "#004C54",
          secondaryColor: "#A5ACAF",
          accentColor: "#000000",
          conference: "NFC",
          division: "NFC East",
        })
        .returning();
      teamsCreated.push(team2.id);

      const playerA = crypto.randomUUID();
      const playerB = crypto.randomUUID();
      await db.insert(players).values([
        {
          id: playerA,
          leagueId: league.id,
          teamId: team2.id,
          firstName: "Alpha",
          lastName: "Trader",
          injuryStatus: "healthy",
          ...sizeFor("WR"),
          birthDate: "2000-01-01",
        },
        {
          id: playerB,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Beta",
          lastName: "Swap",
          injuryStatus: "healthy",
          ...sizeFor("RB"),
          birthDate: "2000-06-01",
        },
      ]);
      playersCreated.push(playerA, playerB);
      await db.insert(playerAttributes).values([
        { playerId: playerA, ...attributesForBucket("WR") },
        { playerId: playerB, ...attributesForBucket("RB") },
      ]);

      const tradeId = crypto.randomUUID();
      await db.insert(playerTransactions).values([
        {
          playerId: playerA,
          teamId: team2.id,
          counterpartyTeamId: team.id,
          counterpartyPlayerId: playerB,
          tradeId,
          type: "traded",
          seasonYear: 2025,
          occurredAt: new Date("2025-10-15T12:00:00Z"),
          detail: "Traded for Beta Swap and a 3rd-round pick",
        },
        {
          playerId: playerB,
          teamId: team.id,
          counterpartyTeamId: team2.id,
          counterpartyPlayerId: playerA,
          tradeId,
          type: "traded",
          seasonYear: 2025,
          occurredAt: new Date("2025-10-15T12:00:00Z"),
          detail: "Traded for Alpha Trader and a 3rd-round pick",
        },
      ]);

      const detailA = await repo.getDetailById(playerA);
      assertEquals(detailA?.transactions.length, 1);
      assertEquals(detailA?.transactions[0].type, "traded");
      assertEquals(detailA?.transactions[0].tradeId, tradeId);
      assertEquals(detailA?.transactions[0].counterpartyPlayer?.id, playerB);
      assertEquals(
        detailA?.transactions[0].counterpartyPlayer?.firstName,
        "Beta",
      );
      assertEquals(
        detailA?.transactions[0].counterpartyPlayer?.lastName,
        "Swap",
      );

      const detailB = await repo.getDetailById(playerB);
      assertEquals(detailB?.transactions.length, 1);
      assertEquals(detailB?.transactions[0].tradeId, tradeId);
      assertEquals(detailB?.transactions[0].counterpartyPlayer?.id, playerA);
      assertEquals(
        detailB?.transactions[0].counterpartyPlayer?.firstName,
        "Alpha",
      );

      assertEquals(
        detailA?.transactions[0].tradeId,
        detailB?.transactions[0].tradeId,
      );
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
        injuryStatus: "healthy",
        ...sizeFor("QB"),
        college: "State University",
        hometown: "Dallas, TX",
        birthDate: "2000-03-10",
        draftYear: 2022,
        draftRound: 1,
        draftPick: 3,
        draftingTeamId: team.id,
      });
      playersCreated.push(playerId);
      await db.insert(playerAttributes).values({
        playerId,
        ...attributesForBucket("QB"),
      });

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

Deno.test({
  name:
    "playersRepository.findDraftEligiblePlayers: returns only prospects in the given league, sorted by projected round",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createPlayersRepository({ db, log: createTestLogger() });
    const playersCreated: string[] = [];
    const teamsCreated: string[] = [];
    const leaguesCreated: string[] = [];
    const citiesCreated: string[] = [];
    const statesCreated: string[] = [];
    const seasonsCreated: string[] = [];

    try {
      const { league, team, city, state } = await setupFixtures(db);
      leaguesCreated.push(league.id);
      teamsCreated.push(team.id);
      citiesCreated.push(city.id);
      statesCreated.push(state.id);

      const [season] = await db
        .insert(seasons)
        .values({ leagueId: league.id, year: 2028 })
        .returning();
      seasonsCreated.push(season.id);

      const prospectEarly = crypto.randomUUID();
      const prospectLate = crypto.randomUUID();
      const prospectNoProjection = crypto.randomUUID();
      const activePlayer = crypto.randomUUID();
      await db.insert(players).values([
        {
          id: prospectLate,
          leagueId: league.id,
          status: "prospect",
          firstName: "Zeb",
          lastName: "Young",
          ...sizeFor("WR"),
          birthDate: "2004-02-01",
        },
        {
          id: prospectEarly,
          leagueId: league.id,
          status: "prospect",
          firstName: "Abe",
          lastName: "Adams",
          ...sizeFor("QB"),
          birthDate: "2004-03-01",
          college: "State",
          hometown: "Austin, TX",
        },
        {
          id: prospectNoProjection,
          leagueId: league.id,
          status: "prospect",
          firstName: "Cal",
          lastName: "Baker",
          ...sizeFor("RB"),
          birthDate: "2004-04-01",
        },
        {
          id: activePlayer,
          leagueId: league.id,
          teamId: team.id,
          status: "active",
          firstName: "Sam",
          lastName: "Stone",
          ...sizeFor("QB"),
          birthDate: "2000-01-01",
        },
      ]);
      playersCreated.push(
        prospectEarly,
        prospectLate,
        prospectNoProjection,
        activePlayer,
      );

      await db.insert(playerAttributes).values([
        { playerId: prospectEarly, ...attributesForBucket("QB") },
        { playerId: prospectLate, ...attributesForBucket("WR") },
        { playerId: prospectNoProjection, ...attributesForBucket("RB") },
        { playerId: activePlayer, ...attributesForBucket("QB") },
      ]);
      await db.insert(playerDraftProfile).values([
        {
          playerId: prospectEarly,
          seasonId: season.id,
          draftClassYear: 2028,
          projectedRound: 1,
          ...attributesForBucket("QB"),
        },
        {
          playerId: prospectLate,
          seasonId: season.id,
          draftClassYear: 2028,
          projectedRound: 5,
          ...attributesForBucket("WR"),
        },
        {
          playerId: prospectNoProjection,
          seasonId: season.id,
          draftClassYear: 2028,
          projectedRound: null,
          ...attributesForBucket("RB"),
        },
      ]);

      const result = await repo.findDraftEligiblePlayers(league.id);
      assertEquals(result.length, 3);
      assertEquals(result[0].id, prospectEarly);
      assertEquals(result[1].id, prospectLate);
      assertEquals(result[2].id, prospectNoProjection);
      assertEquals(result[0].projectedRound, 1);
      assertEquals(result[0].draftClassYear, 2028);
      assertEquals(result[0].hometown, "Austin, TX");
    } finally {
      await cleanup(db, {
        players: playersCreated,
        teams: teamsCreated,
        cities: citiesCreated,
        states: statesCreated,
        leagues: leaguesCreated,
      });
      for (const id of seasonsCreated) {
        await db.delete(seasons).where(eq(seasons.id, id));
      }
      await client.end();
    }
  },
});

Deno.test({
  name:
    "playersRepository.transitionProspectToActive: flips a prospect to active and returns ok",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createPlayersRepository({ db, log: createTestLogger() });
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

      const prospectId = crypto.randomUUID();
      await db.insert(players).values({
        id: prospectId,
        leagueId: league.id,
        status: "prospect",
        firstName: "Abe",
        lastName: "Adams",
        ...sizeFor("QB"),
        birthDate: "2004-03-01",
      });
      playersCreated.push(prospectId);
      await db.insert(playerAttributes).values({
        playerId: prospectId,
        ...attributesForBucket("QB"),
      });

      const result = await repo.transitionProspectToActive({
        playerId: prospectId,
        teamId: team.id,
      });
      assertEquals(result, "ok");

      const [row] = await db.select().from(players).where(
        eq(players.id, prospectId),
      );
      assertEquals(row.status, "active");
      assertEquals(row.teamId, team.id);
      assertEquals(row.draftingTeamId, team.id);

      // Re-running must not transition an already-active player.
      const second = await repo.transitionProspectToActive({
        playerId: prospectId,
        teamId: team.id,
      });
      assertEquals(second, "not_found");
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
    "playersRepository.transitionProspectToActive: returns not_found when the id is unknown",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const repo = createPlayersRepository({ db, log: createTestLogger() });
    try {
      const result = await repo.transitionProspectToActive({
        playerId: crypto.randomUUID(),
        teamId: crypto.randomUUID(),
      });
      assertEquals(result, "not_found");
    } finally {
      await client.end();
    }
  },
});

Deno.test({
  name:
    "playersRepository.getDetailById: surfaces preDraftEvaluation when a draft profile exists",
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
    const seasonsCreated: string[] = [];

    try {
      const { league, team, city, state } = await setupFixtures(db);
      leaguesCreated.push(league.id);
      citiesCreated.push(city.id);
      statesCreated.push(state.id);
      teamsCreated.push(team.id);

      const [season] = await db
        .insert(seasons)
        .values({ leagueId: league.id, year: 2028 })
        .returning();
      seasonsCreated.push(season.id);

      const playerId = crypto.randomUUID();
      await db.insert(players).values({
        id: playerId,
        leagueId: league.id,
        status: "active",
        firstName: "Abe",
        lastName: "Adams",
        ...sizeFor("QB"),
        birthDate: "2004-03-01",
      });
      playersCreated.push(playerId);
      await db.insert(playerAttributes).values({
        playerId,
        ...attributesForBucket("QB"),
      });
      await db.insert(playerDraftProfile).values({
        playerId,
        seasonId: season.id,
        draftClassYear: 2028,
        projectedRound: 2,
        scoutingNotes: "Riser during the combine.",
        ...attributesForBucket("QB"),
      });

      const detail = await repo.getDetailById(playerId);
      assertEquals(detail?.preDraftEvaluation?.draftClassYear, 2028);
      assertEquals(detail?.preDraftEvaluation?.projectedRound, 2);
      assertEquals(
        detail?.preDraftEvaluation?.scoutingNotes,
        "Riser during the combine.",
      );
    } finally {
      await cleanup(db, {
        players: playersCreated,
        teams: teamsCreated,
        cities: citiesCreated,
        states: statesCreated,
        leagues: leaguesCreated,
      });
      for (const id of seasonsCreated) {
        await db.delete(seasons).where(eq(seasons.id, id));
      }
      await client.end();
    }
  },
});
