import { assertEquals, assertRejects } from "@std/assert";
import {
  DomainError,
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributes,
  type PlayerDetail,
} from "@zone-blitz/shared";
import { createPlayersService } from "./players.service.ts";
import type {
  GeneratedPlayers,
  PlayersGenerator,
} from "./players.generator.interface.ts";
import type { PlayersRepository } from "./players.repository.interface.ts";

function createMockRepo(
  overrides: Partial<PlayersRepository> = {},
): PlayersRepository {
  return {
    getDetailById: () => Promise.resolve(undefined),
    ...overrides,
  };
}

function createTestLogger() {
  return {
    child: () => createTestLogger(),
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  } as unknown as import("pino").Logger;
}

function createEmptyPlayers(): GeneratedPlayers {
  return {
    players: [],
    draftProspects: [],
  };
}

function createMockGenerator(
  overrides: Partial<PlayersGenerator> = {},
): PlayersGenerator {
  return {
    generate: () => createEmptyPlayers(),
    generateContracts: () => [],
    ...overrides,
  };
}

function stubAttrs(): PlayerAttributes {
  const attrs: Record<string, number> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    attrs[key] = 40;
    attrs[`${key}Potential`] = 60;
  }
  return attrs as PlayerAttributes;
}

interface InsertCall {
  table: unknown;
  values: unknown[];
}

function createMockDb(rosteredPlayerIds: string[] = []): {
  db: import("../../db/connection.ts").Database;
  calls: InsertCall[];
} {
  const calls: InsertCall[] = [];
  const db = {
    insert(table: unknown) {
      return {
        values(values: unknown[]) {
          calls.push({ table, values });
          const chain = {
            returning(_columns?: unknown) {
              if (Array.isArray(values)) {
                return Promise.resolve(
                  values.map((v, i) => ({
                    id: rosteredPlayerIds[i] ??
                      `generated-${calls.length}-${i}`,
                    teamId: (v as { teamId?: string | null }).teamId ?? null,
                  })),
                );
              }
              return Promise.resolve([]);
            },
          };
          return Object.assign(Promise.resolve(), chain);
        },
      };
    },
  } as unknown as import("../../db/connection.ts").Database;
  return { db, calls };
}

Deno.test("players.service — getDetail", async (t) => {
  await t.step(
    "returns the detail when the repo finds the player",
    async () => {
      const detail: PlayerDetail = {
        id: "p1",
        firstName: "Sam",
        lastName: "Stone",
        position: "QB",
        age: 28,
        heightInches: 74,
        weightPounds: 225,
        yearsOfExperience: 5,
        injuryStatus: "healthy",
        currentTeam: {
          id: "t1",
          name: "Bengals",
          city: "Cincinnati",
          abbreviation: "CIN",
        },
        origin: {
          draftYear: 2020,
          draftRound: 1,
          draftPick: 1,
          draftingTeam: {
            id: "t1",
            name: "Bengals",
            city: "Cincinnati",
            abbreviation: "CIN",
          },
          college: "State University",
          hometown: "Dallas, TX",
        },
        currentContract: null,
        contractHistory: [],
        transactions: [],
        seasonStats: [],
        accolades: [],
      };
      const { db } = createMockDb();
      const service = createPlayersService({
        generator: createMockGenerator(),
        repo: createMockRepo({
          getDetailById: (id) => {
            assertEquals(id, "p1");
            return Promise.resolve(detail);
          },
        }),
        db,
        log: createTestLogger(),
      });

      const result = await service.getDetail("p1");
      assertEquals(result.id, "p1");
      assertEquals(result.origin.draftYear, 2020);
    },
  );

  await t.step("throws NOT_FOUND when the repo returns undefined", async () => {
    const { db } = createMockDb();
    const service = createPlayersService({
      generator: createMockGenerator(),
      repo: createMockRepo(),
      db,
      log: createTestLogger(),
    });
    await assertRejects(
      () => service.getDetail("missing"),
      DomainError,
      "Player missing not found",
    );
  });
});

Deno.test("players.service", async (t) => {
  await t.step(
    "generate inserts players, attributes, draft prospects, and contracts",
    async () => {
      const { db, calls } = createMockDb(["p1", "p2"]);
      const generator = createMockGenerator({
        generate: () => ({
          players: [
            {
              player: {
                leagueId: "l1",
                teamId: "t1",
                status: "active",
                firstName: "A",
                lastName: "B",
                position: "QB",
                injuryStatus: "healthy",
                heightInches: 72,
                weightPounds: 220,
                college: null,
                hometown: null,
                birthDate: "2000-01-01",
                draftYear: null,
                draftRound: null,
                draftPick: null,
                draftingTeamId: null,
              },
              attributes: stubAttrs(),
            },
            {
              player: {
                leagueId: "l1",
                teamId: "t1",
                status: "active",
                firstName: "C",
                lastName: "D",
                position: "QB",
                injuryStatus: "healthy",
                heightInches: 72,
                weightPounds: 220,
                college: null,
                hometown: null,
                birthDate: "2000-01-01",
                draftYear: null,
                draftRound: null,
                draftPick: null,
                draftingTeamId: null,
              },
              attributes: stubAttrs(),
            },
          ],
          draftProspects: [
            {
              prospect: {
                seasonId: "s1",
                firstName: "K",
                lastName: "L",
                position: "QB",
                heightInches: 72,
                weightPounds: 220,
                college: null,
                birthDate: "2003-01-01",
              },
              attributes: stubAttrs(),
            },
          ],
        }),
        generateContracts: (input) => {
          return input.players.map((p) => ({
            playerId: p.id,
            teamId: p.teamId!,
            totalYears: 3,
            currentYear: 1,
            totalSalary: 300_000,
            annualSalary: 100_000,
            guaranteedMoney: 100_000,
            signingBonus: 0,
          }));
        },
      });

      const service = createPlayersService({
        generator,
        repo: createMockRepo(),
        db,
        log: createTestLogger(),
      });

      const result = await service.generate({
        leagueId: "l1",
        seasonId: "s1",
        teamIds: ["t1"],
        rosterSize: 2,
        salaryCap: 255_000_000,
      });

      assertEquals(result.playerCount, 2);
      assertEquals(result.draftProspectCount, 1);
      assertEquals(result.contractCount, 2);

      // 7 insert calls: players, player_attributes, player_transactions,
      // draft_prospects, draft_prospect_attributes, contracts, contract_history
      assertEquals(calls.length, 7);

      const attributeCall = calls[1];
      const attributeRows = attributeCall.values as Array<
        Record<string, unknown>
      >;
      assertEquals(attributeRows.length, 2);
      assertEquals(attributeRows[0].playerId, "p1");
      assertEquals(attributeRows[1].playerId, "p2");
      assertEquals(attributeRows[0].speed, 40);
      assertEquals(attributeRows[0].speedPotential, 60);
    },
  );

  await t.step(
    "generate skips inserts for empty generator output",
    async () => {
      const { db, calls } = createMockDb();
      const generator = createMockGenerator();

      const service = createPlayersService({
        generator,
        repo: createMockRepo(),
        db,
        log: createTestLogger(),
      });

      const result = await service.generate({
        leagueId: "l1",
        seasonId: "s1",
        teamIds: [],
        rosterSize: 0,
        salaryCap: 0,
      });

      assertEquals(result.playerCount, 0);
      assertEquals(result.draftProspectCount, 0);
      assertEquals(result.contractCount, 0);
      assertEquals(calls.length, 0);
    },
  );

  await t.step(
    "generate routes inserts through tx when provided",
    async () => {
      const { db, calls: dbCalls } = createMockDb(["p1"]);
      const { db: tx, calls: txCalls } = createMockDb(["p1"]);
      const generator = createMockGenerator({
        generate: () => ({
          players: [
            {
              player: {
                leagueId: "l1",
                teamId: "t1",
                status: "active",
                firstName: "A",
                lastName: "B",
                position: "QB",
                injuryStatus: "healthy",
                heightInches: 72,
                weightPounds: 220,
                college: null,
                hometown: null,
                birthDate: "2000-01-01",
                draftYear: null,
                draftRound: null,
                draftPick: null,
                draftingTeamId: null,
              },
              attributes: stubAttrs(),
            },
          ],
          draftProspects: [],
        }),
        generateContracts: () => [],
      });

      const service = createPlayersService({
        generator,
        repo: createMockRepo(),
        db,
        log: createTestLogger(),
      });

      await service.generate(
        {
          leagueId: "l1",
          seasonId: "s1",
          teamIds: ["t1"],
          rosterSize: 1,
          salaryCap: 100_000,
        },
        tx,
      );

      assertEquals(dbCalls.length, 0);
      // players + player_attributes + player_transactions writes routed through tx
      assertEquals(txCalls.length, 3);
    },
  );

  await t.step(
    "generate passes inserted players to contract generator",
    async () => {
      const { db } = createMockDb(["player-1"]);
      let contractsGeneratorReceivedPlayers:
        | { id: string; teamId: string | null }[]
        | undefined;

      const generator = createMockGenerator({
        generate: () => ({
          players: [
            {
              player: {
                leagueId: "l1",
                teamId: "t1",
                status: "active",
                firstName: "A",
                lastName: "B",
                position: "QB",
                injuryStatus: "healthy",
                heightInches: 72,
                weightPounds: 220,
                college: null,
                hometown: null,
                birthDate: "2000-01-01",
                draftYear: null,
                draftRound: null,
                draftPick: null,
                draftingTeamId: null,
              },
              attributes: stubAttrs(),
            },
          ],
          draftProspects: [],
        }),
        generateContracts: (input) => {
          contractsGeneratorReceivedPlayers = input.players;
          return [];
        },
      });

      const service = createPlayersService({
        generator,
        repo: createMockRepo(),
        db,
        log: createTestLogger(),
      });

      await service.generate({
        leagueId: "l1",
        seasonId: "s1",
        teamIds: ["t1"],
        rosterSize: 1,
        salaryCap: 100_000,
      });

      assertEquals(contractsGeneratorReceivedPlayers?.length, 1);
      assertEquals(contractsGeneratorReceivedPlayers?.[0].id, "player-1");
      assertEquals(contractsGeneratorReceivedPlayers?.[0].teamId, "t1");
    },
  );
});
