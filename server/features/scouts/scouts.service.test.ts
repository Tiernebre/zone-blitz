import { assertEquals, assertRejects } from "@std/assert";
import { DomainError } from "@zone-blitz/shared";
import type { ScoutDetail, ScoutNode } from "@zone-blitz/shared";
import { createScoutsService } from "./scouts.service.ts";
import type { ScoutsGenerator } from "./scouts.generator.interface.ts";
import type { ScoutsRepository } from "./scouts.repository.interface.ts";

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
    generatePool: () => [],
    ...overrides,
  };
}

function createMockRepo(
  overrides: Partial<ScoutsRepository> = {},
): ScoutsRepository {
  return {
    getStaffTreeByTeam: () => Promise.resolve([]),
    getScoutDetailById: () => Promise.resolve(undefined),
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

function createNode(overrides: Partial<ScoutNode> = {}): ScoutNode {
  return {
    id: "s1",
    firstName: "Alex",
    lastName: "Stone",
    role: "DIRECTOR",
    reportsToId: null,
    coverage: null,
    age: 55,
    yearsWithTeam: 3,
    contractYearsRemaining: 4,
    workCapacity: 200,
    isVacancy: false,
    ...overrides,
  };
}

function createDetail(overrides: Partial<ScoutDetail> = {}): ScoutDetail {
  return {
    id: "s1",
    leagueId: "l1",
    teamId: "t1",
    firstName: "Alex",
    lastName: "Stone",
    role: "DIRECTOR",
    coverage: null,
    age: 55,
    yearsWithTeam: 3,
    contractYearsRemaining: 4,
    contractSalary: 1_500_000,
    contractBuyout: 2_000_000,
    workCapacity: 200,
    isVacancy: false,
    reputationLabels: [],
    careerStops: [],
    evaluations: [],
    crossChecks: [],
    externalTrackRecord: [],
    connections: [],
    ...overrides,
  };
}

const baseGenerated = {
  leagueId: "l1",
  teamId: "t1",
  role: "AREA_SCOUT" as const,
  reportsToId: null,
  coverage: "Northeast",
  age: 42,
  yearsExperience: 12,
  hiredAt: new Date(),
  contractYears: 2,
  contractSalary: 250_000,
  contractBuyout: 300_000,
  workCapacity: 120,
  isVacancy: false,
  marketTierPref: null,
  philosophyFitPref: null,
  staffFitPref: null,
  compensationPref: null,
  minimumThreshold: null,
};

Deno.test("scouts.service", async (t) => {
  await t.step(
    "generate inserts generated scouts and returns count",
    async () => {
      const { db, calls } = createMockDb();
      const generator = createMockGenerator({
        generate: () => [
          { ...baseGenerated, id: "s1", firstName: "A", lastName: "B" },
          { ...baseGenerated, id: "s2", firstName: "C", lastName: "D" },
        ],
      });

      const service = createScoutsService({
        generator,
        repo: createMockRepo(),
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
    "generate skips insert when generator returns empty",
    async () => {
      const { db, calls } = createMockDb();
      const service = createScoutsService({
        generator: createMockGenerator(),
        repo: createMockRepo(),
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

  await t.step(
    "generate routes inserts through tx when provided",
    async () => {
      const { db, calls: dbCalls } = createMockDb();
      const { db: tx, calls: txCalls } = createMockDb();
      const generator = createMockGenerator({
        generate: () => [
          { ...baseGenerated, id: "s1", firstName: "A", lastName: "B" },
        ],
      });

      const service = createScoutsService({
        generator,
        repo: createMockRepo(),
        db,
        log: createTestLogger(),
      });

      await service.generate({ leagueId: "l1", teamIds: ["t1"] }, tx);

      assertEquals(dbCalls.length, 0);
      assertEquals(txCalls.length, 1);
    },
  );

  await t.step(
    "getStaffTree delegates to repository with league and team",
    async () => {
      const { db } = createMockDb();
      const nodes = [createNode()];
      const service = createScoutsService({
        generator: createMockGenerator(),
        repo: createMockRepo({
          getStaffTreeByTeam: (leagueId, teamId) => {
            assertEquals(leagueId, "l1");
            assertEquals(teamId, "t1");
            return Promise.resolve(nodes);
          },
        }),
        db,
        log: createTestLogger(),
      });

      const result = await service.getStaffTree("l1", "t1");
      assertEquals(result, nodes);
    },
  );

  await t.step("getScoutDetail returns the detail when found", async () => {
    const { db } = createMockDb();
    const detail = createDetail();
    const service = createScoutsService({
      generator: createMockGenerator(),
      repo: createMockRepo({
        getScoutDetailById: () => Promise.resolve(detail),
      }),
      db,
      log: createTestLogger(),
    });

    const result = await service.getScoutDetail("s1");
    assertEquals(result, detail);
  });

  await t.step(
    "getScoutDetail throws NOT_FOUND when repository returns undefined",
    async () => {
      const { db } = createMockDb();
      const service = createScoutsService({
        generator: createMockGenerator(),
        repo: createMockRepo(),
        db,
        log: createTestLogger(),
      });

      await assertRejects(
        () => service.getScoutDetail("missing"),
        DomainError,
        "Scout missing not found",
      );
    },
  );

  await t.step(
    "generatePool inserts pool scouts and returns count",
    async () => {
      const { db, calls } = createMockDb();
      const generator = createMockGenerator({
        generatePool: () => [
          {
            ...baseGenerated,
            id: "s1",
            firstName: "A",
            lastName: "B",
            teamId: null,
          },
          {
            ...baseGenerated,
            id: "s2",
            firstName: "C",
            lastName: "D",
            teamId: null,
          },
        ],
      });

      const service = createScoutsService({
        generator,
        repo: createMockRepo(),
        db,
        log: createTestLogger(),
      });

      const result = await service.generatePool({
        leagueId: "l1",
        numberOfTeams: 2,
      });

      assertEquals(result.scoutCount, 2);
      assertEquals(calls.length, 1);
    },
  );

  await t.step(
    "generatePool skips insert when generator returns empty",
    async () => {
      const { db, calls } = createMockDb();
      const service = createScoutsService({
        generator: createMockGenerator(),
        repo: createMockRepo(),
        db,
        log: createTestLogger(),
      });

      const result = await service.generatePool({
        leagueId: "l1",
        numberOfTeams: 0,
      });

      assertEquals(result.scoutCount, 0);
      assertEquals(calls.length, 0);
    },
  );

  await t.step(
    "generatePool routes inserts through tx when provided",
    async () => {
      const { db, calls: dbCalls } = createMockDb();
      const { db: tx, calls: txCalls } = createMockDb();
      const generator = createMockGenerator({
        generatePool: () => [
          {
            ...baseGenerated,
            id: "s1",
            firstName: "A",
            lastName: "B",
            teamId: null,
          },
        ],
      });

      const service = createScoutsService({
        generator,
        repo: createMockRepo(),
        db,
        log: createTestLogger(),
      });

      await service.generatePool(
        { leagueId: "l1", numberOfTeams: 2 },
        tx,
      );

      assertEquals(dbCalls.length, 0);
      assertEquals(txCalls.length, 1);
    },
  );
});
