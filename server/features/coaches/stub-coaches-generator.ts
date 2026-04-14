import type { CoachRole, CoachSpecialty } from "@zone-blitz/shared";
import {
  createNameGenerator,
  type NameGenerator,
} from "../../shared/name-generator.ts";
import type {
  CoachesGenerator,
  CoachesGeneratorInput,
  GeneratedCoach,
  GeneratedCoachTendencies,
} from "./coaches.generator.interface.ts";
import {
  defensiveVectorFromArchetype,
  offensiveVectorFromArchetype,
  pickDefensiveArchetype,
  pickOffensiveArchetype,
} from "./coach-tendency-archetypes.ts";

interface RoleSpec {
  role: CoachRole;
  specialty: CoachSpecialty;
  age: number;
  contractYears: number;
  contractSalary: number;
  contractBuyout: number;
  reportsTo: "HC" | "OC" | "DC" | "STC" | null;
}

const STAFF_BLUEPRINT: RoleSpec[] = [
  {
    role: "HC",
    specialty: "ceo",
    age: 52,
    contractYears: 4,
    contractSalary: 10_000_000,
    contractBuyout: 20_000_000,
    reportsTo: null,
  },
  {
    role: "OC",
    specialty: "offense",
    age: 48,
    contractYears: 3,
    contractSalary: 3_500_000,
    contractBuyout: 5_000_000,
    reportsTo: "HC",
  },
  {
    role: "DC",
    specialty: "defense",
    age: 49,
    contractYears: 3,
    contractSalary: 3_500_000,
    contractBuyout: 5_000_000,
    reportsTo: "HC",
  },
  {
    role: "STC",
    specialty: "special_teams",
    age: 47,
    contractYears: 2,
    contractSalary: 1_500_000,
    contractBuyout: 2_000_000,
    reportsTo: "HC",
  },
  {
    role: "QB",
    specialty: "quarterbacks",
    age: 42,
    contractYears: 2,
    contractSalary: 1_200_000,
    contractBuyout: 1_500_000,
    reportsTo: "OC",
  },
  {
    role: "RB",
    specialty: "running_backs",
    age: 41,
    contractYears: 2,
    contractSalary: 900_000,
    contractBuyout: 1_000_000,
    reportsTo: "OC",
  },
  {
    role: "WR",
    specialty: "wide_receivers",
    age: 43,
    contractYears: 2,
    contractSalary: 900_000,
    contractBuyout: 1_000_000,
    reportsTo: "OC",
  },
  {
    role: "TE",
    specialty: "tight_ends",
    age: 40,
    contractYears: 2,
    contractSalary: 800_000,
    contractBuyout: 900_000,
    reportsTo: "OC",
  },
  {
    role: "OL",
    specialty: "offensive_line",
    age: 50,
    contractYears: 3,
    contractSalary: 1_400_000,
    contractBuyout: 1_800_000,
    reportsTo: "OC",
  },
  {
    role: "DL",
    specialty: "defensive_line",
    age: 46,
    contractYears: 2,
    contractSalary: 1_100_000,
    contractBuyout: 1_300_000,
    reportsTo: "DC",
  },
  {
    role: "LB",
    specialty: "linebackers",
    age: 44,
    contractYears: 2,
    contractSalary: 1_000_000,
    contractBuyout: 1_200_000,
    reportsTo: "DC",
  },
  {
    role: "DB",
    specialty: "defensive_backs",
    age: 45,
    contractYears: 2,
    contractSalary: 1_000_000,
    contractBuyout: 1_200_000,
    reportsTo: "DC",
  },
  {
    role: "ST_ASSISTANT",
    specialty: "special_teams",
    age: 38,
    contractYears: 1,
    contractSalary: 450_000,
    contractBuyout: 450_000,
    reportsTo: "STC",
  },
];

function buildTendencies(
  role: CoachRole,
  seed: string,
): GeneratedCoachTendencies | null {
  if (role === "OC") {
    return {
      offense: offensiveVectorFromArchetype(
        pickOffensiveArchetype(seed),
        seed,
      ),
    };
  }
  if (role === "DC") {
    return {
      defense: defensiveVectorFromArchetype(
        pickDefensiveArchetype(seed),
        seed,
      ),
    };
  }
  return null;
}

export interface StubCoachesGeneratorOptions {
  nameGenerator?: NameGenerator;
}

export function createStubCoachesGenerator(
  options: StubCoachesGeneratorOptions = {},
): CoachesGenerator {
  const nameGenerator = options.nameGenerator ?? createNameGenerator();
  return {
    generate(input: CoachesGeneratorInput): GeneratedCoach[] {
      const coaches: GeneratedCoach[] = [];
      const now = new Date();
      let collegeIndex = 0;
      const pool = input.collegeIds ?? [];

      for (const teamId of input.teamIds) {
        const idsByRole = new Map<CoachRole, string>();
        for (const spec of STAFF_BLUEPRINT) {
          idsByRole.set(spec.role, crypto.randomUUID());
        }

        for (const spec of STAFF_BLUEPRINT) {
          const { firstName, lastName } = nameGenerator.next();
          const id = idsByRole.get(spec.role)!;
          const reportsToId = spec.reportsTo === null
            ? null
            : idsByRole.get(spec.reportsTo)!;
          const hiredAt = new Date(now);
          hiredAt.setFullYear(hiredAt.getFullYear() - spec.contractYears + 1);
          const collegeId = pool.length > 0
            ? pool[collegeIndex++ % pool.length]
            : null;

          const tendencies = buildTendencies(spec.role, id);

          coaches.push({
            id,
            leagueId: input.leagueId,
            teamId,
            firstName,
            lastName,
            role: spec.role,
            reportsToId,
            playCaller: spec.role === "HC" ? "offense" : null,
            age: spec.age,
            hiredAt,
            contractYears: spec.contractYears,
            contractSalary: spec.contractSalary,
            contractBuyout: spec.contractBuyout,
            collegeId,
            specialty: spec.specialty,
            isVacancy: false,
            mentorCoachId: null,
            ...(tendencies ? { tendencies } : {}),
          });
        }
      }

      return coaches;
    },
  };
}
