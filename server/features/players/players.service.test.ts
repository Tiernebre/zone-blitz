import { assertEquals } from "@std/assert";
import {
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributes,
} from "@zone-blitz/shared";
import { createPlayersService } from "./players.service.ts";
import type {
  GeneratedPlayers,
  PlayersGenerator,
} from "./players.generator.interface.ts";

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
                birthDate: "2000-01-01",
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
                birthDate: "2000-01-01",
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

      // 5 insert calls: players, player_attributes, draft_prospects,
      // draft_prospect_attributes, contracts
      assertEquals(calls.length, 5);

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
                birthDate: "2000-01-01",
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
      // players + player_attributes writes routed through tx
      assertEquals(txCalls.length, 2);
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
                birthDate: "2000-01-01",
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
