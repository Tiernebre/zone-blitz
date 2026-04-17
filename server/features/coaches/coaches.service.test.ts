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
import type { CoachRatingsRepository } from "./coach-ratings.repository.ts";
import type { GeneratedCoachRatings } from "./coaches.generator.interface.ts";

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
    generatePool: () => [],
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

function createMockRatingsRepo(
  overrides: Partial<CoachRatingsRepository> = {},
): CoachRatingsRepository {
  return {
    getByCoachId: () => Promise.resolve(undefined),
    upsert: (input) =>
      Promise.resolve({
        coachId: input.coachId,
        current: input.current,
        ceiling: input.ceiling,
        growthRate: input.growthRate,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ...overrides,
  };
}

const DEFAULT_RATINGS: GeneratedCoachRatings = {
  current: {
    leadership: 60,
    gameManagement: 55,
    schemeMastery: 50,
    playerDevelopment: 55,
    adaptability: 55,
  },
  ceiling: {
    leadership: 70,
    gameManagement: 65,
    schemeMastery: 60,
    playerDevelopment: 65,
    adaptability: 65,
  },
  growthRate: 55,
};

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
        positionBackground: "GENERALIST" as const,
        isVacancy: false,
        mentorCoachId: null,
        marketTierPref: null,
        philosophyFitPref: null,
        staffFitPref: null,
        compensationPref: null,
        minimumThreshold: null,
        yearsExperience: 15,
        headCoachYears: 0,
        coordinatorYears: 0,
        positionCoachYears: 15,
        ratings: DEFAULT_RATINGS,
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
        ratingsRepo: createMockRatingsRepo(),
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
        ratingsRepo: createMockRatingsRepo(),
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
        ratingsRepo: createMockRatingsRepo(),
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
      ratingsRepo: createMockRatingsRepo(),
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
        positionBackground: "GENERALIST" as const,
        isVacancy: false,
        mentorCoachId: null,
        marketTierPref: null,
        philosophyFitPref: null,
        staffFitPref: null,
        compensationPref: null,
        minimumThreshold: null,
        yearsExperience: 15,
        headCoachYears: 0,
        coordinatorYears: 0,
        positionCoachYears: 15,
        ratings: DEFAULT_RATINGS,
      };
      const generator = createMockGenerator({
        generate: () => [{ ...base, id: "c1", firstName: "A", lastName: "B" }],
      });

      const service = createCoachesService({
        generator,
        repo: createMockRepo(),
        db,
        tendenciesRepo: createMockTendenciesRepo(),
        ratingsRepo: createMockRatingsRepo(),
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
        positionBackground: "GENERALIST" as const,
        isVacancy: false,
        mentorCoachId: null,
        marketTierPref: null,
        philosophyFitPref: null,
        staffFitPref: null,
        compensationPref: null,
        minimumThreshold: null,
        yearsExperience: 15,
        headCoachYears: 0,
        coordinatorYears: 0,
        positionCoachYears: 15,
        ratings: DEFAULT_RATINGS,
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
        ratingsRepo: createMockRatingsRepo(),
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
        positionBackground: "GENERALIST" as const,
        isVacancy: false,
        mentorCoachId: null,
        marketTierPref: null,
        philosophyFitPref: null,
        staffFitPref: null,
        compensationPref: null,
        minimumThreshold: null,
        yearsExperience: 15,
        headCoachYears: 0,
        coordinatorYears: 0,
        positionCoachYears: 15,
        ratings: DEFAULT_RATINGS,
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
        ratingsRepo: createMockRatingsRepo(),
        db,
        log: createTestLogger(),
      });

      await service.generate({ leagueId: "l1", teamIds: ["t1"] });

      assertEquals(upserts.length, 1);
      assertEquals(upserts[0].coachId, "oc");
    },
  );

  await t.step(
    "generate upserts a ratings row for every coach (tendencies or not)",
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
        positionBackground: "GENERALIST" as const,
        isVacancy: false,
        mentorCoachId: null,
        marketTierPref: null,
        philosophyFitPref: null,
        staffFitPref: null,
        compensationPref: null,
        minimumThreshold: null,
        yearsExperience: 15,
        headCoachYears: 0,
        coordinatorYears: 0,
        positionCoachYears: 15,
        ratings: DEFAULT_RATINGS,
      };
      const generator = createMockGenerator({
        generate: () => [
          {
            ...base,
            id: "oc",
            role: "OC",
            specialty: "offense",
            firstName: "O",
            lastName: "C",
          },
          {
            ...base,
            id: "rb",
            role: "RB",
            specialty: "running_backs",
            firstName: "R",
            lastName: "B",
          },
        ],
      });
      const ratingUpserts: { coachId: string; exec: unknown }[] = [];
      const service = createCoachesService({
        generator,
        repo: createMockRepo(),
        tendenciesRepo: createMockTendenciesRepo(),
        ratingsRepo: createMockRatingsRepo({
          upsert: (input, exec) => {
            ratingUpserts.push({ coachId: input.coachId, exec });
            return Promise.resolve({
              coachId: input.coachId,
              current: input.current,
              ceiling: input.ceiling,
              growthRate: input.growthRate,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          },
        }),
        db,
        log: createTestLogger(),
      });

      await service.generate({ leagueId: "l1", teamIds: ["t1"] });

      assertEquals(ratingUpserts.length, 2);
      assertEquals(
        ratingUpserts.map((u) => u.coachId).sort(),
        ["oc", "rb"],
      );
    },
  );

  await t.step(
    "generatePool upserts a ratings row for every pool coach",
    async () => {
      const { db } = createMockDb();
      const base = {
        leagueId: "l1",
        teamId: null,
        role: "HC" as const,
        specialty: "ceo" as const,
        reportsToId: null,
        playCaller: "offense" as const,
        age: 50,
        hiredAt: new Date(),
        contractYears: 3,
        contractSalary: 1_000_000,
        contractBuyout: 1_000_000,
        collegeId: null,
        positionBackground: "GENERALIST" as const,
        isVacancy: false,
        mentorCoachId: null,
        marketTierPref: null,
        philosophyFitPref: null,
        staffFitPref: null,
        compensationPref: null,
        minimumThreshold: null,
        yearsExperience: 15,
        headCoachYears: 0,
        coordinatorYears: 0,
        positionCoachYears: 15,
        ratings: DEFAULT_RATINGS,
      };
      const generator = createMockGenerator({
        generatePool: () => [
          { ...base, id: "p1", firstName: "A", lastName: "B" },
          { ...base, id: "p2", firstName: "C", lastName: "D" },
        ],
      });
      const upserts: string[] = [];
      const service = createCoachesService({
        generator,
        repo: createMockRepo(),
        tendenciesRepo: createMockTendenciesRepo(),
        ratingsRepo: createMockRatingsRepo({
          upsert: (input) => {
            upserts.push(input.coachId);
            return Promise.resolve({
              coachId: input.coachId,
              current: input.current,
              ceiling: input.ceiling,
              growthRate: input.growthRate,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          },
        }),
        db,
        log: createTestLogger(),
      });

      await service.generatePool({ leagueId: "l1", numberOfTeams: 1 });

      assertEquals(upserts.sort(), ["p1", "p2"]);
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
        ratingsRepo: createMockRatingsRepo(),
        log: createTestLogger(),
      });

      await assertRejects(
        () => service.getCoachDetail("missing"),
        DomainError,
        "Coach missing not found",
      );
    },
  );

  await t.step(
    "generatePool persists pool coaches and returns count",
    async () => {
      const { db, calls } = createMockDb();
      const base = {
        leagueId: "l1",
        teamId: null,
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
        positionBackground: "GENERALIST" as const,
        isVacancy: false,
        mentorCoachId: null,
        marketTierPref: null,
        philosophyFitPref: null,
        staffFitPref: null,
        compensationPref: null,
        minimumThreshold: null,
        yearsExperience: 15,
        headCoachYears: 0,
        coordinatorYears: 0,
        positionCoachYears: 15,
        ratings: DEFAULT_RATINGS,
      };
      const generator = createMockGenerator({
        generatePool: () => [
          { ...base, id: "p1", firstName: "A", lastName: "B" },
          { ...base, id: "p2", firstName: "C", lastName: "D" },
          { ...base, id: "p3", firstName: "E", lastName: "F" },
        ],
      });

      const service = createCoachesService({
        generator,
        repo: createMockRepo(),
        db,
        tendenciesRepo: createMockTendenciesRepo(),
        ratingsRepo: createMockRatingsRepo(),
        log: createTestLogger(),
      });

      const result = await service.generatePool({
        leagueId: "l1",
        numberOfTeams: 2,
      });

      assertEquals(result.coachCount, 3);
      assertEquals(calls.length, 1);
    },
  );

  await t.step(
    "generatePool skips insert when generator returns empty",
    async () => {
      const { db, calls } = createMockDb();
      const generator = createMockGenerator({
        generatePool: () => [],
      });

      const service = createCoachesService({
        generator,
        repo: createMockRepo(),
        db,
        tendenciesRepo: createMockTendenciesRepo(),
        ratingsRepo: createMockRatingsRepo(),
        log: createTestLogger(),
      });

      const result = await service.generatePool({
        leagueId: "l1",
        numberOfTeams: 0,
      });

      assertEquals(result.coachCount, 0);
      assertEquals(calls.length, 0);
    },
  );

  await t.step(
    "generatePool persists tendencies for pool coaches carrying them",
    async () => {
      const { db } = createMockDb();
      const base = {
        leagueId: "l1",
        teamId: null,
        reportsToId: null,
        playCaller: null,
        age: 45,
        hiredAt: new Date(),
        contractYears: 3,
        contractSalary: 1_000_000,
        contractBuyout: 1_000_000,
        collegeId: null,
        positionBackground: "GENERALIST" as const,
        isVacancy: false,
        mentorCoachId: null,
        marketTierPref: null,
        philosophyFitPref: null,
        staffFitPref: null,
        compensationPref: null,
        minimumThreshold: null,
        yearsExperience: 15,
        headCoachYears: 0,
        coordinatorYears: 0,
        positionCoachYears: 15,
        ratings: DEFAULT_RATINGS,
      };
      const generator = createMockGenerator({
        generatePool: () => [
          {
            ...base,
            id: "oc",
            role: "OC",
            specialty: "offense",
            firstName: "O",
            lastName: "C",
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
      const tendUpserts: string[] = [];
      const service = createCoachesService({
        generator,
        repo: createMockRepo(),
        tendenciesRepo: createMockTendenciesRepo({
          upsert: (input) => {
            tendUpserts.push(input.coachId);
            return Promise.resolve({
              coachId: input.coachId,
              offense: null,
              defense: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          },
        }),
        ratingsRepo: createMockRatingsRepo(),
        db,
        log: createTestLogger(),
      });

      await service.generatePool({ leagueId: "l1", numberOfTeams: 1 });
      assertEquals(tendUpserts, ["oc"]);
    },
  );

  await t.step(
    "getFingerprint composes OC and DC tendencies from the repo",
    async () => {
      const { db } = createMockDb();
      const ocNode = createNode({ id: "oc1", role: "OC", playCaller: null });
      const dcNode = createNode({ id: "dc1", role: "DC", playCaller: null });
      const service = createCoachesService({
        generator: createMockGenerator(),
        repo: createMockRepo({
          getStaffTreeByTeam: () => Promise.resolve([ocNode, dcNode]),
        }),
        tendenciesRepo: createMockTendenciesRepo({
          getByCoachId: (id) =>
            Promise.resolve(
              id === "oc1"
                ? {
                  coachId: "oc1",
                  offense: {
                    runPassLean: 55,
                    tempo: 50,
                    personnelWeight: 50,
                    formationUnderCenterShotgun: 50,
                    preSnapMotionRate: 50,
                    passingStyle: 50,
                    passingDepth: 50,
                    runGameBlocking: 50,
                    rpoIntegration: 50,
                  },
                  defense: null,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                }
                : undefined,
            ),
        }),
        ratingsRepo: createMockRatingsRepo(),
        db,
        log: createTestLogger(),
      });

      const fingerprint = await service.getFingerprint("l1", "t1");
      assertEquals(typeof fingerprint, "object");
    },
  );

  await t.step(
    "generatePool routes inserts through tx when provided",
    async () => {
      const { db, calls: dbCalls } = createMockDb();
      const { db: tx, calls: txCalls } = createMockDb();
      const base = {
        leagueId: "l1",
        teamId: null,
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
        positionBackground: "GENERALIST" as const,
        isVacancy: false,
        mentorCoachId: null,
        marketTierPref: null,
        philosophyFitPref: null,
        staffFitPref: null,
        compensationPref: null,
        minimumThreshold: null,
        yearsExperience: 15,
        headCoachYears: 0,
        coordinatorYears: 0,
        positionCoachYears: 15,
        ratings: DEFAULT_RATINGS,
      };
      const generator = createMockGenerator({
        generatePool: () => [
          { ...base, id: "p1", firstName: "A", lastName: "B" },
        ],
      });

      const service = createCoachesService({
        generator,
        repo: createMockRepo(),
        db,
        tendenciesRepo: createMockTendenciesRepo(),
        ratingsRepo: createMockRatingsRepo(),
        log: createTestLogger(),
      });

      await service.generatePool({ leagueId: "l1", numberOfTeams: 1 }, tx);

      assertEquals(dbCalls.length, 0);
      assertEquals(txCalls.length, 1);
    },
  );
});
