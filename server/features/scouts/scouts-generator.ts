import type { ScoutRole } from "@zone-blitz/shared";
import {
  createNameGenerator,
  type NameGenerator,
} from "../../shared/name-generator.ts";
import type {
  GeneratedScout,
  ScoutsGenerator,
  ScoutsGeneratorInput,
  ScoutsPoolInput,
} from "./scouts.generator.interface.ts";

// Graduated from a flat constants blueprint (every director age 58, every
// area scout salary $250k, every workCapacity exactly 120) into a
// distribution-driven staff generator. The reportsTo tree is preserved
// exactly: one director per team, two cross-checkers (East/West coverage)
// reporting to the director, and four area scouts (NE/SE/MW/W) splitting
// under the appropriate cross-checker. Age, contract length, salary,
// buyout, work capacity, and tenure (hiredAt) are rolled per scout within
// role bands so league-wide scouting departments don't ship as identical
// mirror images of each other.

export type { NameGenerator };

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
  reportsTo: BlueprintKey | null;
}

const STAFF_BLUEPRINT: RoleSpec[] = [
  { key: "DIRECTOR", role: "DIRECTOR", coverage: null, reportsTo: null },
  {
    key: "EAST_CC",
    role: "NATIONAL_CROSS_CHECKER",
    coverage: "East",
    reportsTo: "DIRECTOR",
  },
  {
    key: "WEST_CC",
    role: "NATIONAL_CROSS_CHECKER",
    coverage: "West",
    reportsTo: "DIRECTOR",
  },
  {
    key: "AREA_NE",
    role: "AREA_SCOUT",
    coverage: "Northeast",
    reportsTo: "EAST_CC",
  },
  {
    key: "AREA_SE",
    role: "AREA_SCOUT",
    coverage: "Southeast",
    reportsTo: "EAST_CC",
  },
  {
    key: "AREA_MW",
    role: "AREA_SCOUT",
    coverage: "Midwest",
    reportsTo: "WEST_CC",
  },
  {
    key: "AREA_W",
    role: "AREA_SCOUT",
    coverage: "West Coast",
    reportsTo: "WEST_CC",
  },
];

export const SCOUTS_PER_TEAM = STAFF_BLUEPRINT.length;

const POOL_MULTIPLIER = 1.5;

interface RoleBand {
  ageMin: number;
  ageMax: number;
  salaryMin: number;
  salaryMax: number;
  yearsMin: number;
  yearsMax: number;
  buyoutYearsMin: number;
  buyoutYearsMax: number;
  workCapacityMin: number;
  workCapacityMax: number;
  tenureMin: number;
  tenureMax: number;
}

const ROLE_BANDS: Record<ScoutRole, RoleBand> = {
  DIRECTOR: {
    ageMin: 50,
    ageMax: 65,
    salaryMin: 800_000,
    salaryMax: 2_500_000,
    yearsMin: 3,
    yearsMax: 5,
    buyoutYearsMin: 1,
    buyoutYearsMax: 2,
    workCapacityMin: 160,
    workCapacityMax: 240,
    tenureMin: 0,
    tenureMax: 5,
  },
  NATIONAL_CROSS_CHECKER: {
    ageMin: 42,
    ageMax: 58,
    salaryMin: 400_000,
    salaryMax: 1_200_000,
    yearsMin: 2,
    yearsMax: 4,
    buyoutYearsMin: 0,
    buyoutYearsMax: 1,
    workCapacityMin: 140,
    workCapacityMax: 220,
    tenureMin: 0,
    tenureMax: 4,
  },
  AREA_SCOUT: {
    ageMin: 30,
    ageMax: 50,
    salaryMin: 120_000,
    salaryMax: 400_000,
    yearsMin: 1,
    yearsMax: 3,
    buyoutYearsMin: 0,
    buyoutYearsMax: 1,
    workCapacityMin: 80,
    workCapacityMax: 160,
    tenureMin: 0,
    tenureMax: 3,
  },
};

export interface ScoutsGeneratorOptions {
  /**
   * Injected name generator. Defaults to the shared server-wide
   * `createNameGenerator()`; tests pass a seeded generator for determinism.
   */
  nameGenerator?: NameGenerator;
  /** Injected RNG for deterministic tests; defaults to `Math.random`. */
  random?: () => number;
  /** Anchor date for hiredAt math; defaults to `new Date()`. */
  now?: () => Date;
}

function intInRange(random: () => number, min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

interface ScoutPreferences {
  marketTierPref: number;
  philosophyFitPref: number;
  staffFitPref: number;
  compensationPref: number;
  minimumThreshold: number;
}

function rollPreferences(random: () => number): ScoutPreferences {
  return {
    marketTierPref: intInRange(random, 0, 100),
    philosophyFitPref: intInRange(random, 0, 100),
    staffFitPref: intInRange(random, 0, 100),
    compensationPref: intInRange(random, 0, 100),
    minimumThreshold: intInRange(random, 0, 100),
  };
}

const NULL_PREFERENCES = {
  marketTierPref: null,
  philosophyFitPref: null,
  staffFitPref: null,
  compensationPref: null,
  minimumThreshold: null,
};

export function createScoutsGenerator(
  options: ScoutsGeneratorOptions = {},
): ScoutsGenerator {
  const random = options.random ?? Math.random;
  const nameGenerator = options.nameGenerator ?? createNameGenerator();
  const now = options.now ?? (() => new Date());

  return {
    generate(input: ScoutsGeneratorInput): GeneratedScout[] {
      const scouts: GeneratedScout[] = [];
      const anchor = now();

      for (const teamId of input.teamIds) {
        const idsByKey = new Map<BlueprintKey, string>();
        for (const spec of STAFF_BLUEPRINT) {
          idsByKey.set(spec.key, crypto.randomUUID());
        }

        for (const spec of STAFF_BLUEPRINT) {
          const { firstName, lastName } = nameGenerator.next();
          const id = idsByKey.get(spec.key)!;
          const reportsToId = spec.reportsTo === null
            ? null
            : idsByKey.get(spec.reportsTo)!;

          const band = ROLE_BANDS[spec.role];
          const age = intInRange(random, band.ageMin, band.ageMax);
          const contractYears = intInRange(
            random,
            band.yearsMin,
            band.yearsMax,
          );
          // 25k step so output reads as plausible salary numbers rather
          // than arbitrary 6-digit values.
          const salarySteps = Math.max(
            1,
            Math.floor((band.salaryMax - band.salaryMin) / 25_000),
          );
          const contractSalary = band.salaryMin +
            intInRange(random, 0, salarySteps) * 25_000;
          const buyoutYears = intInRange(
            random,
            band.buyoutYearsMin,
            band.buyoutYearsMax,
          );
          const contractBuyout = contractSalary * buyoutYears;
          const workCapacity = intInRange(
            random,
            band.workCapacityMin,
            band.workCapacityMax,
          );
          const tenureYears = intInRange(
            random,
            band.tenureMin,
            band.tenureMax,
          );
          const hiredAt = new Date(anchor);
          hiredAt.setUTCFullYear(hiredAt.getUTCFullYear() - tenureYears);

          scouts.push({
            id,
            leagueId: input.leagueId,
            teamId,
            firstName,
            lastName,
            role: spec.role,
            reportsToId,
            coverage: spec.coverage,
            age,
            hiredAt,
            contractYears,
            contractSalary,
            contractBuyout,
            workCapacity,
            isVacancy: false,
            ...NULL_PREFERENCES,
          });
        }
      }

      return scouts;
    },

    generatePool(input: ScoutsPoolInput): GeneratedScout[] {
      if (input.numberOfTeams === 0) return [];

      const scouts: GeneratedScout[] = [];
      const anchor = now();
      const countPerRole = Math.ceil(input.numberOfTeams * POOL_MULTIPLIER);

      for (const spec of STAFF_BLUEPRINT) {
        for (let i = 0; i < countPerRole; i++) {
          const { firstName, lastName } = nameGenerator.next();
          const id = crypto.randomUUID();

          const band = ROLE_BANDS[spec.role];
          const age = intInRange(random, band.ageMin, band.ageMax);
          const contractYears = intInRange(
            random,
            band.yearsMin,
            band.yearsMax,
          );
          const salarySteps = Math.max(
            1,
            Math.floor((band.salaryMax - band.salaryMin) / 25_000),
          );
          const contractSalary = band.salaryMin +
            intInRange(random, 0, salarySteps) * 25_000;
          const buyoutYears = intInRange(
            random,
            band.buyoutYearsMin,
            band.buyoutYearsMax,
          );
          const contractBuyout = contractSalary * buyoutYears;
          const workCapacity = intInRange(
            random,
            band.workCapacityMin,
            band.workCapacityMax,
          );
          const tenureYears = intInRange(
            random,
            band.tenureMin,
            band.tenureMax,
          );
          const hiredAt = new Date(anchor);
          hiredAt.setUTCFullYear(hiredAt.getUTCFullYear() - tenureYears);

          scouts.push({
            id,
            leagueId: input.leagueId,
            teamId: null,
            firstName,
            lastName,
            role: spec.role,
            reportsToId: null,
            coverage: spec.coverage,
            age,
            hiredAt,
            contractYears,
            contractSalary,
            contractBuyout,
            workCapacity,
            isVacancy: false,
            ...rollPreferences(random),
          });
        }
      }

      return scouts;
    },
  };
}
