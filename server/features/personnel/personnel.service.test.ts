import { assertEquals } from "@std/assert";
import { createPersonnelService } from "./personnel.service.ts";
import type {
  GeneratedPersonnel,
  PersonnelGenerator,
} from "./personnel.generator.interface.ts";
import type { PlayersService } from "../players/players.service.interface.ts";
import type { CoachesService } from "../coaches/coaches.service.interface.ts";
import type { ScoutsService } from "../scouts/scouts.service.interface.ts";

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
    frontOfficeStaff: [],
  };
}

function createMockGenerator(
  overrides: Partial<PersonnelGenerator> = {},
): PersonnelGenerator {
  return {
    generate: () => createEmptyPersonnel(),
    ...overrides,
  };
}

function createMockPlayersService(
  overrides: Partial<PlayersService> = {},
): PlayersService {
  return {
    generateAndPersist: () =>
      Promise.resolve({
        playerCount: 0,
        draftProspectCount: 0,
        contractCount: 0,
      }),
    ...overrides,
  };
}

function createMockCoachesService(
  overrides: Partial<CoachesService> = {},
): CoachesService {
  return {
    generateAndPersist: () => Promise.resolve({ coachCount: 0 }),
    ...overrides,
  };
}

function createMockScoutsService(
  overrides: Partial<ScoutsService> = {},
): ScoutsService {
  return {
    generateAndPersist: () => Promise.resolve({ scoutCount: 0 }),
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

Deno.test("personnel.service", async (t) => {
  await t.step(
    "generateAndPersist delegates to players, coaches, scouts services and inserts front office",
    async () => {
      const { db, calls } = createMockDb();
      const generator = createMockGenerator({
        generate: () => ({
          frontOfficeStaff: [
            { leagueId: "l1", teamId: "t1", firstName: "I", lastName: "J" },
          ],
        }),
      });

      let playersServiceInput:
        | {
          leagueId: string;
          seasonId: string;
          teamIds: string[];
          rosterSize: number;
          salaryCap: number;
        }
        | undefined;
      const playersService = createMockPlayersService({
        generateAndPersist: (input) => {
          playersServiceInput = input;
          return Promise.resolve({
            playerCount: 2,
            draftProspectCount: 1,
            contractCount: 2,
          });
        },
      });

      let coachesServiceInput:
        | { leagueId: string; teamIds: string[] }
        | undefined;
      const coachesService = createMockCoachesService({
        generateAndPersist: (input) => {
          coachesServiceInput = input;
          return Promise.resolve({ coachCount: 5 });
        },
      });

      let scoutsServiceInput:
        | { leagueId: string; teamIds: string[] }
        | undefined;
      const scoutsService = createMockScoutsService({
        generateAndPersist: (input) => {
          scoutsServiceInput = input;
          return Promise.resolve({ scoutCount: 3 });
        },
      });

      const service = createPersonnelService({
        generator,
        playersService,
        coachesService,
        scoutsService,
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
      assertEquals(result.coachCount, 5);
      assertEquals(result.scoutCount, 3);
      assertEquals(result.frontOfficeCount, 1);
      assertEquals(result.draftProspectCount, 1);
      assertEquals(result.contractCount, 2);

      assertEquals(playersServiceInput?.leagueId, "l1");
      assertEquals(playersServiceInput?.seasonId, "s1");
      assertEquals(playersServiceInput?.teamIds, ["t1"]);
      assertEquals(playersServiceInput?.rosterSize, 2);
      assertEquals(playersServiceInput?.salaryCap, 255_000_000);

      assertEquals(coachesServiceInput?.leagueId, "l1");
      assertEquals(coachesServiceInput?.teamIds, ["t1"]);

      assertEquals(scoutsServiceInput?.leagueId, "l1");
      assertEquals(scoutsServiceInput?.teamIds, ["t1"]);

      // 1 insert call: frontOffice
      assertEquals(calls.length, 1);
    },
  );

  await t.step(
    "generateAndPersist skips inserts for empty generator output",
    async () => {
      const { db, calls } = createMockDb();
      const generator = createMockGenerator();
      const playersService = createMockPlayersService();
      const coachesService = createMockCoachesService();
      const scoutsService = createMockScoutsService();

      const service = createPersonnelService({
        generator,
        playersService,
        coachesService,
        scoutsService,
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
});
