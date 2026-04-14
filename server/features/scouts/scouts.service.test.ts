import { assertEquals } from "@std/assert";
import { createScoutsService } from "./scouts.service.ts";
import type { ScoutsGenerator } from "./scouts.generator.interface.ts";

function createTestLogger() {
  return {
    child: () => createTestLogger(),
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  } as unknown as import("pino").Logger;
}

function createMockGenerator(
  overrides: Partial<ScoutsGenerator> = {},
): ScoutsGenerator {
  return {
    generate: () => [],
    ...overrides,
  };
}

interface InsertCall {
  table: unknown;
  values: unknown[];
}

function createMockDb(): {
  db: import("../../db/connection.ts").Database;
  calls: InsertCall[];
} {
  const calls: InsertCall[] = [];
  const db = {
    insert(table: unknown) {
      return {
        values(values: unknown[]) {
          calls.push({ table, values });
          return Promise.resolve([]);
        },
      };
    },
  } as unknown as import("../../db/connection.ts").Database;
  return { db, calls };
}

Deno.test("scouts.service", async (t) => {
  await t.step(
    "generate inserts generated scouts and returns count",
    async () => {
      const { db, calls } = createMockDb();
      const generator = createMockGenerator({
        generate: () => [
          { leagueId: "l1", teamId: "t1", firstName: "A", lastName: "B" },
          { leagueId: "l1", teamId: "t1", firstName: "C", lastName: "D" },
        ],
      });

      const service = createScoutsService({
        generator,
        db,
        log: createTestLogger(),
      });

      const result = await service.generate({
        leagueId: "l1",
        teamIds: ["t1"],
      });

      assertEquals(result.scoutCount, 2);
      assertEquals(calls.length, 1);
    },
  );

  await t.step(
    "generate routes inserts through tx when provided",
    async () => {
      const { db, calls: dbCalls } = createMockDb();
      const { db: tx, calls: txCalls } = createMockDb();
      const generator = createMockGenerator({
        generate: () => [
          { leagueId: "l1", teamId: "t1", firstName: "A", lastName: "B" },
        ],
      });

      const service = createScoutsService({
        generator,
        db,
        log: createTestLogger(),
      });

      await service.generate({ leagueId: "l1", teamIds: ["t1"] }, tx);

      assertEquals(dbCalls.length, 0);
      assertEquals(txCalls.length, 1);
    },
  );

  await t.step(
    "generate skips insert when generator returns empty",
    async () => {
      const { db, calls } = createMockDb();
      const generator = createMockGenerator();

      const service = createScoutsService({
        generator,
        db,
        log: createTestLogger(),
      });

      const result = await service.generate({
        leagueId: "l1",
        teamIds: [],
      });

      assertEquals(result.scoutCount, 0);
      assertEquals(calls.length, 0);
    },
  );
});
