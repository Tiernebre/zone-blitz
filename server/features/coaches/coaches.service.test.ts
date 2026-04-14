import { assertEquals, assertRejects } from "@std/assert";
import { DomainError } from "@zone-blitz/shared";
import type {
  CoachDetail,
  CoachNode,
  CoachRole,
  CoachSpecialty,
} from "@zone-blitz/shared";
import { createCoachesService } from "./coaches.service.ts";
import type { CoachesGenerator } from "./coaches.generator.interface.ts";
import type { CoachesRepository } from "./coaches.repository.interface.ts";
import type { CoachTendenciesRepository } from "./coach-tendencies.repository.interface.ts";

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

function createMockRepo(
  overrides: Partial<CoachesRepository> = {},
): CoachesRepository {
  return {
    getStaffTreeByTeam: () => Promise.resolve([]),
    getCoachDetailById: () => Promise.resolve(undefined),
    ...overrides,
  };
}

function createMockTendenciesRepo(
  overrides: Partial<CoachTendenciesRepository> = {},
): CoachTendenciesRepository {
  return {
    getByCoachId: () => Promise.resolve(undefined),
    upsert: (input) =>
      Promise.resolve({
        coachId: input.coachId,
        offense: null,
        defense: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
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

function createNode(overrides: Partial<CoachNode> = {}): CoachNode {
  return {
    id: "c1",
    firstName: "Alex",
    lastName: "Stone",
    role: "HC" as CoachRole,
    reportsToId: null,
    playCaller: "offense",
    specialty: "ceo" as CoachSpecialty,
    age: 52,
    yearsWithTeam: 3,
    contractYearsRemaining: 4,
    isVacancy: false,
    ...overrides,
  };
}

function createDetail(overrides: Partial<CoachDetail> = {}): CoachDetail {
  return {
    id: "c1",
    leagueId: "l1",
    teamId: "t1",
    firstName: "Alex",
    lastName: "Stone",
    role: "HC",
    specialty: "ceo",
    playCaller: "offense",
    age: 52,
    yearsWithTeam: 3,
    contractYearsRemaining: 4,
    contractSalary: 10_000_000,
    contractBuyout: 20_000_000,
    isVacancy: false,
    college: null,
    mentor: null,
    reputationLabels: [],
    careerStops: [],
    tenureUnitPerformance: [],
    tenurePlayerDev: [],
    accolades: [],
    depthChartNotes: [],
    connections: [],
    ...overrides,
  };
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
        repo: createMockRepo(),
        db,
        tendenciesRepo: createMockTendenciesRepo(),
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
        repo: createMockRepo(),
        db,
        tendenciesRepo: createMockTendenciesRepo(),
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

  await t.step(
    "getStaffTree delegates to repository with league and team",
    async () => {
      const { db } = createMockDb();
      const nodes = [createNode()];
      const service = createCoachesService({
        generator: createMockGenerator(),
        repo: createMockRepo({
          getStaffTreeByTeam: (leagueId, teamId) => {
            assertEquals(leagueId, "l1");
            assertEquals(teamId, "t1");
            return Promise.resolve(nodes);
          },
        }),
        db,
        tendenciesRepo: createMockTendenciesRepo(),
        log: createTestLogger(),
      });

      const result = await service.getStaffTree("l1", "t1");
      assertEquals(result, nodes);
    },
  );

  await t.step("getCoachDetail returns the detail when found", async () => {
    const { db } = createMockDb();
    const detail = createDetail();
    const service = createCoachesService({
      generator: createMockGenerator(),
      repo: createMockRepo({
        getCoachDetailById: () => Promise.resolve(detail),
      }),
      db,
      tendenciesRepo: createMockTendenciesRepo(),
      log: createTestLogger(),
    });

    const result = await service.getCoachDetail("c1");
    assertEquals(result, detail);
  });

  await t.step(
    "generate routes inserts through tx when provided",
    async () => {
      const { db, calls: dbCalls } = createMockDb();
      const { db: tx, calls: txCalls } = createMockDb();
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
        generate: () => [{ ...base, id: "c1", firstName: "A", lastName: "B" }],
      });

      const service = createCoachesService({
        generator,
        repo: createMockRepo(),
        db,
        tendenciesRepo: createMockTendenciesRepo(),
        log: createTestLogger(),
      });

      await service.generate({ leagueId: "l1", teamIds: ["t1"] }, tx);

      assertEquals(dbCalls.length, 0);
      assertEquals(txCalls.length, 1);
    },
  );

  await t.step(
    "generate routes tendency upserts through tx so FK sees the coach row",
    async () => {
      const { db } = createMockDb();
      const { db: tx } = createMockDb();
      const base = {
        leagueId: "l1",
        teamId: "t1",
        role: "OC" as const,
        specialty: "offense" as const,
        reportsToId: null,
        playCaller: null,
        age: 45,
        hiredAt: new Date(),
        contractYears: 3,
        contractSalary: 1_000_000,
        contractBuyout: 1_000_000,
        collegeId: null,
        isVacancy: false,
        mentorCoachId: null,
      };
      const generator = createMockGenerator({
        generate: () => [
          {
            ...base,
            id: "oc",
            firstName: "Off",
            lastName: "Coord",
            tendencies: {
              offense: {
                runPassLean: 40,
                tempo: 50,
                personnelWeight: 55,
                formationUnderCenterShotgun: 30,
                preSnapMotionRate: 80,
                passingStyle: 30,
                passingDepth: 45,
                runGameBlocking: 20,
                rpoIntegration: 30,
              },
            },
          },
        ],
      });
      const seenExecutors: unknown[] = [];
      const service = createCoachesService({
        generator,
        repo: createMockRepo(),
        tendenciesRepo: createMockTendenciesRepo({
          upsert: (input, exec) => {
            seenExecutors.push(exec);
            return Promise.resolve({
              coachId: input.coachId,
              offense: null,
              defense: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          },
        }),
        db,
        log: createTestLogger(),
      });

      await service.generate({ leagueId: "l1", teamIds: ["t1"] }, tx);

      assertEquals(seenExecutors.length, 1);
      assertEquals(seenExecutors[0], tx);
    },
  );

  await t.step(
    "generate upserts a tendency row per coordinator who carries one",
    async () => {
      const { db } = createMockDb();
      const base = {
        leagueId: "l1",
        teamId: "t1",
        reportsToId: null,
        playCaller: null,
        age: 45,
        hiredAt: new Date(),
        contractYears: 3,
        contractSalary: 1_000_000,
        contractBuyout: 1_000_000,
        collegeId: null,
        isVacancy: false,
        mentorCoachId: null,
      };
      const generator = createMockGenerator({
        generate: () => [
          {
            ...base,
            id: "oc",
            role: "OC",
            specialty: "offense",
            firstName: "Off",
            lastName: "Coord",
            tendencies: {
              offense: {
                runPassLean: 40,
                tempo: 50,
                personnelWeight: 55,
                formationUnderCenterShotgun: 30,
                preSnapMotionRate: 80,
                passingStyle: 30,
                passingDepth: 45,
                runGameBlocking: 20,
                rpoIntegration: 30,
              },
            },
          },
          {
            ...base,
            id: "rb",
            role: "RB",
            specialty: "running_backs",
            firstName: "RB",
            lastName: "Coach",
          },
        ],
      });
      const upserts: { coachId: string }[] = [];
      const service = createCoachesService({
        generator,
        repo: createMockRepo(),
        tendenciesRepo: createMockTendenciesRepo({
          upsert: (input) => {
            upserts.push({ coachId: input.coachId });
            return Promise.resolve({
              coachId: input.coachId,
              offense: null,
              defense: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          },
        }),
        db,
        log: createTestLogger(),
      });

      await service.generate({ leagueId: "l1", teamIds: ["t1"] });

      assertEquals(upserts.length, 1);
      assertEquals(upserts[0].coachId, "oc");
    },
  );

  await t.step(
    "getCoachDetail throws NOT_FOUND when repository returns undefined",
    async () => {
      const { db } = createMockDb();
      const service = createCoachesService({
        generator: createMockGenerator(),
        repo: createMockRepo(),
        db,
        tendenciesRepo: createMockTendenciesRepo(),
        log: createTestLogger(),
      });

      await assertRejects(
        () => service.getCoachDetail("missing"),
        DomainError,
        "Coach missing not found",
      );
    },
  );
});
