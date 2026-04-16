import { assertEquals, assertGreater } from "@std/assert";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import pino from "pino";
import { type NeutralBucket, PLAYER_ATTRIBUTE_KEYS } from "@zone-blitz/shared";
import * as schema from "../../db/schema.ts";
import { players } from "../players/player.schema.ts";
import { playerAttributes } from "../players/attributes.schema.ts";
import { depthChartEntries } from "../depth-chart/depth-chart.schema.ts";
import { playerTransactions } from "../contracts/player-transaction.schema.ts";
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
import { seasons } from "../season/season.schema.ts";
import { createDepthChartPublisher } from "../depth-chart/depth-chart.publisher.ts";
import { createRosterTransactionService } from "./roster-transaction.service.ts";

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
  const [season] = await db
    .insert(seasons)
    .values({ leagueId: league.id, year: 1 })
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
    .values({ name: `TestCity-${crypto.randomUUID()}`, stateId: state.id })
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
  return { league, season, team, state, city, franchise };
}

async function createCoachStaff(
  db: ReturnType<typeof createTestDb>["db"],
  leagueId: string,
  teamId: string,
) {
  const hcId = crypto.randomUUID();
  const ocId = crypto.randomUUID();
  const dcId = crypto.randomUUID();
  await db.insert(coaches).values([
    {
      id: hcId,
      leagueId,
      teamId,
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
      leagueId,
      teamId,
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
      leagueId,
      teamId,
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
  return { hcId, ocId, dcId };
}

async function createPlayer(
  db: ReturnType<typeof createTestDb>["db"],
  leagueId: string,
  teamId: string | null,
  bucket: NeutralBucket,
) {
  const id = crypto.randomUUID();
  await db.insert(players).values({
    id,
    leagueId,
    teamId,
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
  return id;
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
    seasons?: string[];
  },
) {
  if (ids.coaches?.length) {
    await db.delete(coaches).where(inArray(coaches.id, ids.coaches));
  }
  if (ids.players?.length) {
    await db.delete(players).where(inArray(players.id, ids.players));
  }
  if (ids.seasons?.length) {
    await db.delete(seasons).where(inArray(seasons.id, ids.seasons));
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
    "rosterTransactionService.recordAndRepublish: signing a free agent regenerates depth chart to include new player",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const log = createTestLogger();
    const publisher = createDepthChartPublisher({ db, log });
    const service = createRosterTransactionService({
      db,
      depthChartPublisher: publisher,
      log,
    });

    const playersCreated: string[] = [];
    const coachesCreated: string[] = [];

    try {
      const { league, season, team, state, city } = await setupFixtures(db);
      const { hcId, ocId, dcId } = await createCoachStaff(
        db,
        league.id,
        team.id,
      );
      coachesCreated.push(hcId, ocId, dcId);

      const qbId = await createPlayer(db, league.id, team.id, "QB");
      const rbId = await createPlayer(db, league.id, team.id, "RB");
      playersCreated.push(qbId, rbId);

      await publisher.publishForTeams({
        leagueId: league.id,
        teamIds: [team.id],
      });

      const entriesBefore = await db
        .select()
        .from(depthChartEntries)
        .where(eq(depthChartEntries.teamId, team.id));
      assertEquals(entriesBefore.length, 2);

      const wrId = await createPlayer(db, league.id, team.id, "WR");
      playersCreated.push(wrId);

      await service.recordAndRepublish({
        leagueId: league.id,
        teamId: team.id,
        playerId: wrId,
        type: "signed",
        seasonYear: season.year,
      });

      const entriesAfter = await db
        .select()
        .from(depthChartEntries)
        .where(eq(depthChartEntries.teamId, team.id));
      assertEquals(entriesAfter.length, 3);

      const newPlayerEntry = entriesAfter.find((e) => e.playerId === wrId);
      assertEquals(newPlayerEntry !== undefined, true);
      assertEquals(typeof newPlayerEntry!.slotCode, "string");
      assertGreater(newPlayerEntry!.slotCode.length, 0);

      const txRows = await db
        .select()
        .from(playerTransactions)
        .where(
          and(
            eq(playerTransactions.playerId, wrId),
            eq(playerTransactions.type, "signed"),
          ),
        );
      assertEquals(txRows.length, 1);
      assertEquals(txRows[0].teamId, team.id);
      assertEquals(txRows[0].seasonYear, season.year);

      await cleanup(db, {
        coaches: coachesCreated,
        players: playersCreated,
        teams: [team.id],
        cities: [city.id],
        states: [state.id],
        leagues: [league.id],
        seasons: [season.id],
      });
    } catch (e) {
      await cleanup(db, {
        coaches: coachesCreated,
        players: playersCreated,
      });
      throw e;
    } finally {
      await client.end();
    }
  },
});

Deno.test({
  name:
    "rosterTransactionService.recordAndRepublish: releasing a player regenerates depth chart without that player",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const log = createTestLogger();
    const publisher = createDepthChartPublisher({ db, log });
    const service = createRosterTransactionService({
      db,
      depthChartPublisher: publisher,
      log,
    });

    const playersCreated: string[] = [];
    const coachesCreated: string[] = [];

    try {
      const { league, season, team, state, city } = await setupFixtures(db);
      const { hcId, ocId, dcId } = await createCoachStaff(
        db,
        league.id,
        team.id,
      );
      coachesCreated.push(hcId, ocId, dcId);

      const qbId = await createPlayer(db, league.id, team.id, "QB");
      const rbId = await createPlayer(db, league.id, team.id, "RB");
      const wrId = await createPlayer(db, league.id, team.id, "WR");
      playersCreated.push(qbId, rbId, wrId);

      await publisher.publishForTeams({
        leagueId: league.id,
        teamIds: [team.id],
      });

      const entriesBefore = await db
        .select()
        .from(depthChartEntries)
        .where(eq(depthChartEntries.teamId, team.id));
      assertEquals(entriesBefore.length, 3);

      await db
        .update(players)
        .set({ teamId: null })
        .where(eq(players.id, wrId));

      await service.recordAndRepublish({
        leagueId: league.id,
        teamId: team.id,
        playerId: wrId,
        type: "released",
        seasonYear: season.year,
      });

      const entriesAfter = await db
        .select()
        .from(depthChartEntries)
        .where(eq(depthChartEntries.teamId, team.id));
      assertEquals(entriesAfter.length, 2);

      const releasedPlayerEntry = entriesAfter.find(
        (e) => e.playerId === wrId,
      );
      assertEquals(releasedPlayerEntry, undefined);

      const txRows = await db
        .select()
        .from(playerTransactions)
        .where(
          and(
            eq(playerTransactions.playerId, wrId),
            eq(playerTransactions.type, "released"),
          ),
        );
      assertEquals(txRows.length, 1);

      await cleanup(db, {
        coaches: coachesCreated,
        players: playersCreated,
        teams: [team.id],
        cities: [city.id],
        states: [state.id],
        leagues: [league.id],
        seasons: [season.id],
      });
    } catch (e) {
      await cleanup(db, {
        coaches: coachesCreated,
        players: playersCreated,
      });
      throw e;
    } finally {
      await client.end();
    }
  },
});

Deno.test({
  name:
    "rosterTransactionService.recordAndRepublish: leaves zero active-roster players without a depth-chart entry",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const log = createTestLogger();
    const publisher = createDepthChartPublisher({ db, log });
    const service = createRosterTransactionService({
      db,
      depthChartPublisher: publisher,
      log,
    });

    const playersCreated: string[] = [];
    const coachesCreated: string[] = [];

    try {
      const { league, season, team, state, city } = await setupFixtures(db);
      const { hcId, ocId, dcId } = await createCoachStaff(
        db,
        league.id,
        team.id,
      );
      coachesCreated.push(hcId, ocId, dcId);

      const qbId = await createPlayer(db, league.id, team.id, "QB");
      const rbId = await createPlayer(db, league.id, team.id, "RB");
      playersCreated.push(qbId, rbId);

      await publisher.publishForTeams({
        leagueId: league.id,
        teamIds: [team.id],
      });

      const teId = await createPlayer(db, league.id, team.id, "TE");
      const edgeId = await createPlayer(db, league.id, team.id, "EDGE");
      playersCreated.push(teId, edgeId);

      await service.recordAndRepublish({
        leagueId: league.id,
        teamId: team.id,
        playerId: teId,
        type: "claimed_on_waivers",
        seasonYear: season.year,
      });

      await service.recordAndRepublish({
        leagueId: league.id,
        teamId: team.id,
        playerId: edgeId,
        type: "signed",
        seasonYear: season.year,
      });

      const rosterPlayerIds = (
        await db
          .select({ id: players.id })
          .from(players)
          .where(
            and(
              eq(players.leagueId, league.id),
              eq(players.teamId, team.id),
            ),
          )
      ).map((r) => r.id);

      const depthChartPlayerIds = (
        await db
          .select({ playerId: depthChartEntries.playerId })
          .from(depthChartEntries)
          .where(eq(depthChartEntries.teamId, team.id))
      ).map((r) => r.playerId);

      assertEquals(new Set(rosterPlayerIds).size, 4);
      assertEquals(new Set(depthChartPlayerIds).size, 4);

      for (const pid of rosterPlayerIds) {
        assertEquals(
          depthChartPlayerIds.includes(pid),
          true,
          `Player ${pid} on roster but missing from depth chart`,
        );
      }

      await cleanup(db, {
        coaches: coachesCreated,
        players: playersCreated,
        teams: [team.id],
        cities: [city.id],
        states: [state.id],
        leagues: [league.id],
        seasons: [season.id],
      });
    } catch (e) {
      await cleanup(db, {
        coaches: coachesCreated,
        players: playersCreated,
      });
      throw e;
    } finally {
      await client.end();
    }
  },
});
