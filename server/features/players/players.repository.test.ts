import { assertEquals } from "@std/assert";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import pino from "pino";
import * as schema from "../../db/schema.ts";
import { players } from "./player.schema.ts";
import { playerAttributes } from "./attributes.schema.ts";
import { playerDraftProfile } from "./player-draft-profile.schema.ts";
import { leagues } from "../league/league.schema.ts";
import { teams } from "../team/team.schema.ts";
import { cities } from "../cities/city.schema.ts";
import { states } from "../states/state.schema.ts";
import { seasons } from "../season/season.schema.ts";
import { PLAYER_ATTRIBUTE_KEYS } from "@zone-blitz/shared";
import { createPlayersRepository } from "./players.repository.ts";

function zeroAttributes(): Record<string, number> {
  const attrs: Record<string, number> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    attrs[key] = 50;
    attrs[`${key}Potential`] = 60;
  }
  return attrs;
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
          position: "WR",
          heightInches: 72,
          weightPounds: 200,
          birthDate: "2004-02-01",
        },
        {
          id: prospectEarly,
          leagueId: league.id,
          status: "prospect",
          firstName: "Abe",
          lastName: "Adams",
          position: "QB",
          heightInches: 74,
          weightPounds: 220,
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
          position: "RB",
          heightInches: 70,
          weightPounds: 205,
          birthDate: "2004-04-01",
        },
        {
          id: activePlayer,
          leagueId: league.id,
          teamId: team.id,
          status: "active",
          firstName: "Sam",
          lastName: "Stone",
          position: "QB",
          heightInches: 74,
          weightPounds: 225,
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
        { playerId: prospectEarly, ...zeroAttributes() },
        { playerId: prospectLate, ...zeroAttributes() },
        { playerId: prospectNoProjection, ...zeroAttributes() },
        { playerId: activePlayer, ...zeroAttributes() },
      ]);
      await db.insert(playerDraftProfile).values([
        {
          playerId: prospectEarly,
          seasonId: season.id,
          draftClassYear: 2028,
          projectedRound: 1,
          ...zeroAttributes(),
        },
        {
          playerId: prospectLate,
          seasonId: season.id,
          draftClassYear: 2028,
          projectedRound: 5,
          ...zeroAttributes(),
        },
        {
          playerId: prospectNoProjection,
          seasonId: season.id,
          draftClassYear: 2028,
          projectedRound: null,
          ...zeroAttributes(),
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
        position: "QB",
        heightInches: 74,
        weightPounds: 220,
        birthDate: "2004-03-01",
      });
      playersCreated.push(prospectId);

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
