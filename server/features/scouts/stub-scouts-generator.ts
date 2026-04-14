import type { ScoutRole } from "@zone-blitz/shared";
import type {
  GeneratedScout,
  ScoutsGenerator,
  ScoutsGeneratorInput,
} from "./scouts.generator.interface.ts";

const FIRST_NAMES = [
  "James",
  "John",
  "Robert",
  "Michael",
  "William",
  "David",
  "Richard",
  "Joseph",
  "Thomas",
  "Charles",
];

const LAST_NAMES = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
];

type BlueprintKey =
  | "DIRECTOR"
  | "EAST_CC"
  | "WEST_CC"
  | "AREA_NE"
  | "AREA_SE"
  | "AREA_MW"
  | "AREA_W";

interface RoleSpec {
  key: BlueprintKey;
  role: ScoutRole;
  coverage: string | null;
  age: number;
  contractYears: number;
  contractSalary: number;
  contractBuyout: number;
  workCapacity: number;
  reportsTo: BlueprintKey | null;
}

const STAFF_BLUEPRINT: RoleSpec[] = [
  {
    key: "DIRECTOR",
    role: "DIRECTOR",
    coverage: null,
    age: 58,
    contractYears: 4,
    contractSalary: 1_500_000,
    contractBuyout: 2_000_000,
    workCapacity: 200,
    reportsTo: null,
  },
  {
    key: "EAST_CC",
    role: "NATIONAL_CROSS_CHECKER",
    coverage: "East",
    age: 50,
    contractYears: 3,
    contractSalary: 750_000,
    contractBuyout: 1_000_000,
    workCapacity: 180,
    reportsTo: "DIRECTOR",
  },
  {
    key: "WEST_CC",
    role: "NATIONAL_CROSS_CHECKER",
    coverage: "West",
    age: 51,
    contractYears: 3,
    contractSalary: 750_000,
    contractBuyout: 1_000_000,
    workCapacity: 180,
    reportsTo: "DIRECTOR",
  },
  {
    key: "AREA_NE",
    role: "AREA_SCOUT",
    coverage: "Northeast",
    age: 44,
    contractYears: 2,
    contractSalary: 250_000,
    contractBuyout: 300_000,
    workCapacity: 120,
    reportsTo: "EAST_CC",
  },
  {
    key: "AREA_SE",
    role: "AREA_SCOUT",
    coverage: "Southeast",
    age: 45,
    contractYears: 2,
    contractSalary: 250_000,
    contractBuyout: 300_000,
    workCapacity: 120,
    reportsTo: "EAST_CC",
  },
  {
    key: "AREA_MW",
    role: "AREA_SCOUT",
    coverage: "Midwest",
    age: 46,
    contractYears: 2,
    contractSalary: 250_000,
    contractBuyout: 300_000,
    workCapacity: 120,
    reportsTo: "WEST_CC",
  },
  {
    key: "AREA_W",
    role: "AREA_SCOUT",
    coverage: "West Coast",
    age: 42,
    contractYears: 2,
    contractSalary: 250_000,
    contractBuyout: 300_000,
    workCapacity: 120,
    reportsTo: "WEST_CC",
  },
];

export const SCOUTS_PER_TEAM = STAFF_BLUEPRINT.length;

function randomName(index: number) {
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
  const lastName =
    LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length];
  return { firstName, lastName };
}

export function createStubScoutsGenerator(): ScoutsGenerator {
  return {
    generate(input: ScoutsGeneratorInput): GeneratedScout[] {
      const scouts: GeneratedScout[] = [];
      const now = new Date();
      let nameIndex = 0;

      for (const teamId of input.teamIds) {
        const idsByKey = new Map<BlueprintKey, string>();
        for (const spec of STAFF_BLUEPRINT) {
          idsByKey.set(spec.key, crypto.randomUUID());
        }

        for (const spec of STAFF_BLUEPRINT) {
          const { firstName, lastName } = randomName(nameIndex++);
          const id = idsByKey.get(spec.key)!;
          const reportsToId = spec.reportsTo === null
            ? null
            : idsByKey.get(spec.reportsTo)!;
          const hiredAt = new Date(now);
          hiredAt.setFullYear(hiredAt.getFullYear() - spec.contractYears + 1);

          scouts.push({
            id,
            leagueId: input.leagueId,
            teamId,
            firstName,
            lastName,
            role: spec.role,
            reportsToId,
            coverage: spec.coverage,
            age: spec.age,
            hiredAt,
            contractYears: spec.contractYears,
            contractSalary: spec.contractSalary,
            contractBuyout: spec.contractBuyout,
            workCapacity: spec.workCapacity,
            isVacancy: false,
          });
        }
      }

      return scouts;
    },
  };
}
