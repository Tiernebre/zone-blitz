import { assertEquals } from "@std/assert";
import { createPersonnelService } from "./personnel.service.ts";
import type {
  GeneratedPersonnel,
  PersonnelGenerator,
} from "./personnel.generator.interface.ts";

function createTestLogger() {
  return {
    child: () => createTestLogger(),
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  } as unknown as import("pino").Logger;
}

function createEmptyPersonnel(): GeneratedPersonnel {
  return {
    players: [],
    coaches: [],
    scouts: [],
    frontOfficeStaff: [],
    draftProspects: [],
  };
}

function createMockGenerator(
  overrides: Partial<PersonnelGenerator> = {},
): PersonnelGenerator {
  return {
    generate: () => createEmptyPersonnel(),
    generateContracts: () => [],
    ...overrides,
  };
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
          return {
            returning(_columns?: unknown) {
              if (Array.isArray(values)) {
                return Promise.resolve(
                  values.map((v, i) => ({
                    id: rosteredPlayerIds[i] ?? `generated-${i}`,
                    teamId: (v as { teamId?: string | null }).teamId ?? null,
                  })),
                );
              }
              return Promise.resolve([]);
            },
          };
        },
      };
    },
  } as unknown as import("../../db/connection.ts").Database;
  return { db, calls };
}

Deno.test("personnel.service", async (t) => {
  await t.step(
    "generateAndPersist inserts generated personnel and returns counts",
    async () => {
      const { db, calls } = createMockDb(["p1", "p2"]);
      const generator = createMockGenerator({
        generate: () => ({
          players: [
            {
              leagueId: "l1",
              teamId: "t1",
              firstName: "A",
              lastName: "B",
            },
            {
              leagueId: "l1",
              teamId: "t1",
              firstName: "C",
              lastName: "D",
            },
          ],
          coaches: [
            {
              leagueId: "l1",
              teamId: "t1",
              firstName: "E",
              lastName: "F",
            },
          ],
          scouts: [
            {
              leagueId: "l1",
              teamId: "t1",
              firstName: "G",
              lastName: "H",
            },
          ],
          frontOfficeStaff: [
            {
              leagueId: "l1",
              teamId: "t1",
              firstName: "I",
              lastName: "J",
            },
          ],
          draftProspects: [
            { seasonId: "s1", firstName: "K", lastName: "L" },
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

      const service = createPersonnelService({
        generator,
        db,
        log: createTestLogger(),
      });

      const result = await service.generateAndPersist({
        leagueId: "l1",
        seasonId: "s1",
        teamIds: ["t1"],
        rosterSize: 2,
        salaryCap: 255_000_000,
      });

      assertEquals(result.playerCount, 2);
      assertEquals(result.coachCount, 1);
      assertEquals(result.scoutCount, 1);
      assertEquals(result.frontOfficeCount, 1);
      assertEquals(result.draftProspectCount, 1);
      assertEquals(result.contractCount, 2);

      // 6 insert calls: players, coaches, scouts, frontOffice, draftProspects, contracts
      assertEquals(calls.length, 6);
    },
  );

  await t.step(
    "generateAndPersist skips inserts for empty generator output",
    async () => {
      const { db, calls } = createMockDb();
      const generator = createMockGenerator();

      const service = createPersonnelService({
        generator,
        db,
        log: createTestLogger(),
      });

      const result = await service.generateAndPersist({
        leagueId: "l1",
        seasonId: "s1",
        teamIds: [],
        rosterSize: 0,
        salaryCap: 0,
      });

      assertEquals(result.playerCount, 0);
      assertEquals(result.coachCount, 0);
      assertEquals(result.scoutCount, 0);
      assertEquals(result.frontOfficeCount, 0);
      assertEquals(result.draftProspectCount, 0);
      assertEquals(result.contractCount, 0);
      assertEquals(calls.length, 0);
    },
  );

  await t.step(
    "generateAndPersist passes inserted players to contract generator",
    async () => {
      const { db } = createMockDb(["player-1"]);
      let contractsGeneratorReceivedPlayers:
        | { id: string; teamId: string | null }[]
        | undefined;

      const generator = createMockGenerator({
        generate: () => ({
          players: [
            {
              leagueId: "l1",
              teamId: "t1",
              firstName: "A",
              lastName: "B",
            },
          ],
          coaches: [],
          scouts: [],
          frontOfficeStaff: [],
          draftProspects: [],
        }),
        generateContracts: (input) => {
          contractsGeneratorReceivedPlayers = input.players;
          return [];
        },
      });

      const service = createPersonnelService({
        generator,
        db,
        log: createTestLogger(),
      });

      await service.generateAndPersist({
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
