import { assertEquals, assertRejects } from "@std/assert";
import {
  DomainError,
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributes,
  type PlayerDetail,
  type PlayerStatus,
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
    findDraftEligiblePlayers: () => Promise.resolve([]),
    transitionProspectToActive: () => Promise.resolve("not_found"),
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
  return { players: [] };
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

function createMockDb(
  rosteredPlayerIds: string[] = [],
  seasonYear: number | null = 2026,
): {
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
                  values.map((v, i) => {
                    const row = v as {
                      teamId?: string | null;
                      status?: PlayerStatus;
                    };
                    return {
                      id: rosteredPlayerIds[i] ??
                        `generated-${calls.length}-${i}`,
                      teamId: row.teamId ?? null,
                      status: row.status ?? "active",
                    };
                  }),
                );
              }
              return Promise.resolve([]);
            },
          };
          return Object.assign(Promise.resolve(), chain);
        },
      };
    },
    select(_columns: unknown) {
      return {
        from(_table: unknown) {
          return {
            where(_expr: unknown) {
              return {
                limit(_n: number) {
                  return Promise.resolve(
                    seasonYear === null ? [] : [{ year: seasonYear }],
                  );
                },
              };
            },
          };
        },
      };
    },
    transaction<T>(
      callback: (tx: import("../../db/connection.ts").Database) => Promise<T>,
    ) {
      return callback(db);
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
        preDraftEvaluation: null,
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
    "generate inserts active players and contracts",
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
        }),
        generateContracts: (input) =>
          input.players.map((p) => ({
            playerId: p.id,
            teamId: p.teamId!,
            totalYears: 3,
            currentYear: 1,
            totalSalary: 300_000,
            annualSalary: 100_000,
            guaranteedMoney: 100_000,
            signingBonus: 0,
          })),
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
      assertEquals(result.draftProspectCount, 0);
      assertEquals(result.contractCount, 2);

      // players + player_attributes + contracts = 3 writes (no prospects)
      assertEquals(calls.length, 3);

      const attributeRows = calls[1].values as Array<Record<string, unknown>>;
      assertEquals(attributeRows.length, 2);
      assertEquals(attributeRows[0].playerId, "p1");
      assertEquals(attributeRows[0].speed, 40);
      assertEquals(attributeRows[0].speedPotential, 60);
    },
  );

  await t.step(
    "generate writes a player_draft_profile row for every prospect-status player",
    async () => {
      const { db, calls } = createMockDb(["prospect-1"], 2027);
      const generator = createMockGenerator({
        generate: () => ({
          players: [
            {
              player: {
                leagueId: "l1",
                teamId: null,
                status: "prospect",
                firstName: "K",
                lastName: "L",
                position: "QB",
                injuryStatus: "healthy",
                heightInches: 72,
                weightPounds: 220,
                college: null,
                hometown: null,
                birthDate: "2003-01-01",
                draftYear: null,
                draftRound: null,
                draftPick: null,
                draftingTeamId: null,
              },
              attributes: stubAttrs(),
            },
          ],
        }),
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
        teamIds: [],
        rosterSize: 0,
        salaryCap: 0,
      });

      assertEquals(result.playerCount, 1);
      assertEquals(result.draftProspectCount, 1);
      assertEquals(result.contractCount, 0);

      // players + player_attributes + player_draft_profile = 3 writes
      assertEquals(calls.length, 3);

      const profileRows = calls[2].values as Array<Record<string, unknown>>;
      assertEquals(profileRows.length, 1);
      assertEquals(profileRows[0].playerId, "prospect-1");
      assertEquals(profileRows[0].seasonId, "s1");
      assertEquals(profileRows[0].draftClassYear, 2027);
      assertEquals(profileRows[0].projectedRound, null);
      assertEquals(profileRows[0].scoutingNotes, null);
      assertEquals(profileRows[0].speed, 40);
    },
  );

  await t.step(
    "generate throws when the season backing a prospect cannot be found",
    async () => {
      const { db } = createMockDb(["prospect-1"], null);
      const generator = createMockGenerator({
        generate: () => ({
          players: [
            {
              player: {
                leagueId: "l1",
                teamId: null,
                status: "prospect",
                firstName: "K",
                lastName: "L",
                position: "QB",
                injuryStatus: "healthy",
                heightInches: 72,
                weightPounds: 220,
                college: null,
                hometown: null,
                birthDate: "2003-01-01",
                draftYear: null,
                draftRound: null,
                draftPick: null,
                draftingTeamId: null,
              },
              attributes: stubAttrs(),
            },
          ],
        }),
      });

      const service = createPlayersService({
        generator,
        repo: createMockRepo(),
        db,
        log: createTestLogger(),
      });

      let caught: Error | undefined;
      try {
        await service.generate({
          leagueId: "l1",
          seasonId: "missing",
          teamIds: [],
          rosterSize: 0,
          salaryCap: 0,
        });
      } catch (err) {
        caught = err as Error;
      }
      assertEquals(caught?.message.includes("missing"), true);
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
        }),
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
      // players + player_attributes routed through tx (no prospects, no contracts since generator returns none)
      assertEquals(txCalls.length, 2);
    },
  );

  await t.step(
    "generate only hands rostered active players to the contract generator",
    async () => {
      const { db } = createMockDb(["player-1", "prospect-1"]);
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
            {
              player: {
                leagueId: "l1",
                teamId: null,
                status: "prospect",
                firstName: "K",
                lastName: "L",
                position: "QB",
                injuryStatus: "healthy",
                heightInches: 72,
                weightPounds: 220,
                college: null,
                hometown: null,
                birthDate: "2003-01-01",
                draftYear: null,
                draftRound: null,
                draftPick: null,
                draftingTeamId: null,
              },
              attributes: stubAttrs(),
            },
          ],
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

Deno.test("players.service — findDraftEligiblePlayers", async (t) => {
  await t.step(
    "delegates to the repo and passes through the result",
    async () => {
      const { db } = createMockDb();
      let seenLeagueId: string | undefined;
      const service = createPlayersService({
        generator: createMockGenerator(),
        repo: createMockRepo({
          findDraftEligiblePlayers: (leagueId) => {
            seenLeagueId = leagueId;
            return Promise.resolve([
              {
                id: "p1",
                firstName: "Abe",
                lastName: "Adams",
                position: "QB",
                college: "State",
                hometown: "Austin, TX",
                heightInches: 74,
                weightPounds: 220,
                birthDate: "2004-03-01",
                draftClassYear: 2028,
                projectedRound: 1,
              },
            ]);
          },
        }),
        db,
        log: createTestLogger(),
      });

      const result = await service.findDraftEligiblePlayers("league-1");
      assertEquals(seenLeagueId, "league-1");
      assertEquals(result.length, 1);
      assertEquals(result[0].id, "p1");
    },
  );
});

Deno.test("players.service — draftPlayer", async (t) => {
  await t.step(
    "runs the transition inside a transaction and resolves on ok",
    async () => {
      const { db } = createMockDb();
      let transitionInput:
        | { playerId: string; teamId: string }
        | undefined;
      const service = createPlayersService({
        generator: createMockGenerator(),
        repo: createMockRepo({
          transitionProspectToActive: (input) => {
            transitionInput = input;
            return Promise.resolve("ok");
          },
        }),
        db,
        log: createTestLogger(),
      });

      await service.draftPlayer({ playerId: "p1", teamId: "t1" });
      assertEquals(transitionInput?.playerId, "p1");
      assertEquals(transitionInput?.teamId, "t1");
    },
  );

  await t.step(
    "throws NOT_FOUND when the repo cannot transition the player",
    async () => {
      const { db } = createMockDb();
      const service = createPlayersService({
        generator: createMockGenerator(),
        repo: createMockRepo({
          transitionProspectToActive: () => Promise.resolve("not_found"),
        }),
        db,
        log: createTestLogger(),
      });
      await assertRejects(
        () => service.draftPlayer({ playerId: "missing", teamId: "t1" }),
        DomainError,
        "not draft-eligible",
      );
    },
  );
});
