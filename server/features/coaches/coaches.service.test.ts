import { assertEquals } from "@std/assert";
import { createCoachesService } from "./coaches.service.ts";
import type { CoachesGenerator } from "./coaches.generator.interface.ts";

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
  overrides: Partial<CoachesGenerator> = {},
): CoachesGenerator {
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

Deno.test("coaches.service", async (t) => {
  await t.step(
    "generate inserts generated coaches and returns count",
    async () => {
      const { db, calls } = createMockDb();
      const base = {
        leagueId: "l1",
        teamId: "t1",
        role: "HC" as const,
        reportsToId: null,
        playCaller: "offense" as const,
        age: 50,
        hiredAt: new Date(),
        contractYears: 3,
        contractSalary: 1_000_000,
        contractBuyout: 1_000_000,
        collegeId: null,
        specialty: "ceo" as const,
        isVacancy: false,
        mentorCoachId: null,
      };
      const generator = createMockGenerator({
        generate: () => [
          { ...base, id: "c1", firstName: "A", lastName: "B" },
          { ...base, id: "c2", firstName: "C", lastName: "D" },
        ],
      });

      const service = createCoachesService({
        generator,
        db,
        log: createTestLogger(),
      });

      const result = await service.generate({
        leagueId: "l1",
        teamIds: ["t1"],
      });

      assertEquals(result.coachCount, 2);
      assertEquals(calls.length, 1);
    },
  );

  await t.step(
    "generate skips insert when generator returns empty",
    async () => {
      const { db, calls } = createMockDb();
      const generator = createMockGenerator();

      const service = createCoachesService({
        generator,
        db,
        log: createTestLogger(),
      });

      const result = await service.generate({
        leagueId: "l1",
        teamIds: [],
      });

      assertEquals(result.coachCount, 0);
      assertEquals(calls.length, 0);
    },
  );
});
