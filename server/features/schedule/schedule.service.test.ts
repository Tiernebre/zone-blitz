import { assertEquals } from "@std/assert";
import { createScheduleService } from "./schedule.service.ts";
import type {
  ScheduleGenerator,
  TeamDivisionInfo,
} from "./schedule.generator.interface.ts";

function createTestLogger() {
  return {
    child: () => createTestLogger(),
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  } as unknown as import("pino").Logger;
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
          return Promise.resolve();
        },
      };
    },
  } as unknown as import("../../db/connection.ts").Database;
  return { db, calls };
}

const TEAMS: TeamDivisionInfo[] = [
  { teamId: "t1", conference: "AFC", division: "East" },
  { teamId: "t2", conference: "AFC", division: "East" },
];

Deno.test("schedule.service", async (t) => {
  await t.step(
    "generate inserts generated games and returns count",
    async () => {
      const { db, calls } = createMockDb();
      const generator: ScheduleGenerator = {
        generate: () => [
          {
            seasonId: "s1",
            week: 1,
            homeTeamId: "t1",
            awayTeamId: "t2",
          },
          {
            seasonId: "s1",
            week: 2,
            homeTeamId: "t2",
            awayTeamId: "t1",
          },
        ],
      };

      const service = createScheduleService({
        generator,
        db,
        log: createTestLogger(),
      });

      const result = await service.generate({
        seasonId: "s1",
        teams: TEAMS,
        seasonLength: 17,
      });

      assertEquals(result.gameCount, 2);
      assertEquals(calls.length, 1);
      assertEquals((calls[0].values as unknown[]).length, 2);
    },
  );

  await t.step(
    "generate skips insert when generator returns no games",
    async () => {
      const { db, calls } = createMockDb();
      const generator: ScheduleGenerator = {
        generate: () => [],
      };

      const service = createScheduleService({
        generator,
        db,
        log: createTestLogger(),
      });

      const result = await service.generate({
        seasonId: "s1",
        teams: TEAMS,
        seasonLength: 17,
      });

      assertEquals(result.gameCount, 0);
      assertEquals(calls.length, 0);
    },
  );

  await t.step("generate forwards input to generator", async () => {
    const { db } = createMockDb();
    let receivedInput:
      | { seasonId: string; teams: TeamDivisionInfo[]; seasonLength: number }
      | undefined;
    const generator: ScheduleGenerator = {
      generate: (input) => {
        receivedInput = input;
        return [];
      },
    };

    const service = createScheduleService({
      generator,
      db,
      log: createTestLogger(),
    });

    await service.generate({
      seasonId: "s1",
      teams: TEAMS,
      seasonLength: 17,
    });

    assertEquals(receivedInput?.seasonId, "s1");
    assertEquals(receivedInput?.seasonLength, 17);
    assertEquals(receivedInput?.teams.length, 2);
  });
});
