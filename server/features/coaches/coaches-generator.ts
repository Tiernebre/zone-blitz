import type { CoachRole, CoachSpecialty } from "@zone-blitz/shared";
import {
  createNameGenerator,
  type NameGenerator,
} from "../../shared/name-generator.ts";
import type {
  CoachesGenerator,
  CoachesGeneratorInput,
  CoachesPoolInput,
  GeneratedCoach,
  GeneratedCoachTendencies,
} from "./coaches.generator.interface.ts";
import {
  defensiveVectorFromArchetype,
  offensiveVectorFromArchetype,
  pickDefensiveArchetype,
  pickOffensiveArchetype,
} from "./coach-tendency-archetypes.ts";

// Graduated from a flat constant-per-role blueprint (every HC age 52, every
// OC salary $3.5M, every hiredAt "this year") into a distribution-driven
// staff generator. The reportsTo tree is preserved by role — the blueprint
// still defines the org chart and specialties — but age, contract years,
// salary, buyout, and tenure (hiredAt) are rolled per coach within tier
// bands so three teams no longer ship identical staffs. Name generation,
// like the players generator, is injected via the shared `NameGenerator`
// dependency, and the RNG is injectable so tests are deterministic.

export type { NameGenerator };

type Tier = "HC" | "COORDINATOR" | "POSITION";

interface RoleSpec {
  role: CoachRole;
  specialty: CoachSpecialty;
  tier: Tier;
  reportsTo: "HC" | "OC" | "DC" | "STC" | null;
}

const STAFF_BLUEPRINT: RoleSpec[] = [
  { role: "HC", specialty: "ceo", tier: "HC", reportsTo: null },
  { role: "OC", specialty: "offense", tier: "COORDINATOR", reportsTo: "HC" },
  { role: "DC", specialty: "defense", tier: "COORDINATOR", reportsTo: "HC" },
  {
    role: "STC",
    specialty: "special_teams",
    tier: "COORDINATOR",
    reportsTo: "HC",
  },
  {
    role: "QB",
    specialty: "quarterbacks",
    tier: "POSITION",
    reportsTo: "OC",
  },
  {
    role: "RB",
    specialty: "running_backs",
    tier: "POSITION",
    reportsTo: "OC",
  },
  {
    role: "WR",
    specialty: "wide_receivers",
    tier: "POSITION",
    reportsTo: "OC",
  },
  { role: "TE", specialty: "tight_ends", tier: "POSITION", reportsTo: "OC" },
  {
    role: "OL",
    specialty: "offensive_line",
    tier: "POSITION",
    reportsTo: "OC",
  },
  {
    role: "DL",
    specialty: "defensive_line",
    tier: "POSITION",
    reportsTo: "DC",
  },
  {
    role: "LB",
    specialty: "linebackers",
    tier: "POSITION",
    reportsTo: "DC",
  },
  {
    role: "DB",
    specialty: "defensive_backs",
    tier: "POSITION",
    reportsTo: "DC",
  },
  {
    role: "ST_ASSISTANT",
    specialty: "special_teams",
    tier: "POSITION",
    reportsTo: "STC",
  },
];

interface TierBand {
  ageMin: number;
  ageMax: number;
  /** Salary band in whole dollars; annual. */
  salaryMin: number;
  salaryMax: number;
  /** Contract length band in years, inclusive. */
  yearsMin: number;
  yearsMax: number;
  /** Buyout is modeled as annualSalary * buyoutYearsMin..Max. */
  buyoutYearsMin: number;
  buyoutYearsMax: number;
  /** Tenure (years since hiredAt) band, inclusive. */
  tenureMin: number;
  tenureMax: number;
}

// Per-role override for salary (e.g., an OC earns more than an STC) on top
// of the tier band. When a role is absent from this map, the tier band is
// used directly.
const ROLE_SALARY_OVERRIDES: Partial<
  Record<CoachRole, { salaryMin: number; salaryMax: number }>
> = {
  OC: { salaryMin: 2_500_000, salaryMax: 5_000_000 },
  DC: { salaryMin: 2_500_000, salaryMax: 5_000_000 },
  STC: { salaryMin: 900_000, salaryMax: 1_800_000 },
  OL: { salaryMin: 900_000, salaryMax: 1_800_000 },
  QB: { salaryMin: 700_000, salaryMax: 1_600_000 },
  ST_ASSISTANT: { salaryMin: 300_000, salaryMax: 600_000 },
};

const TIER_BANDS: Record<Tier, TierBand> = {
  HC: {
    ageMin: 48,
    ageMax: 60,
    salaryMin: 6_000_000,
    salaryMax: 14_000_000,
    yearsMin: 3,
    yearsMax: 5,
    buyoutYearsMin: 1,
    buyoutYearsMax: 2,
    tenureMin: 0,
    tenureMax: 4,
  },
  COORDINATOR: {
    ageMin: 40,
    ageMax: 55,
    salaryMin: 1_000_000,
    salaryMax: 5_000_000,
    yearsMin: 2,
    yearsMax: 4,
    buyoutYearsMin: 1,
    buyoutYearsMax: 2,
    tenureMin: 0,
    tenureMax: 3,
  },
  POSITION: {
    ageMin: 32,
    ageMax: 50,
    salaryMin: 400_000,
    salaryMax: 1_400_000,
    yearsMin: 1,
    yearsMax: 3,
    buyoutYearsMin: 0,
    buyoutYearsMax: 1,
    tenureMin: 0,
    tenureMax: 3,
  },
};

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

export interface CoachesGeneratorOptions {
  /**
   * Injected name generator. Defaults to the shared server-wide
   * `createNameGenerator()` so league creation produces varied names without
   * explicit wiring; tests pass a seeded generator for determinism.
   */
  nameGenerator?: NameGenerator;
  /** Injected RNG for deterministic tests; defaults to `Math.random`. */
  random?: () => number;
  /** Anchor date for hiredAt math; defaults to `new Date()`. Injectable for tests. */
  now?: () => Date;
}

function intInRange(random: () => number, min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

const POOL_MULTIPLIER = 1.5;

const COORDINATOR_ROLES = new Set<CoachRole>(["OC", "DC", "STC"]);

function generateCoach(
  spec: RoleSpec,
  leagueId: string,
  teamId: string | null,
  reportsToId: string | null,
  random: () => number,
  nameGenerator: NameGenerator,
  anchor: Date,
  collegeIds: string[],
  collegeIndex: { value: number },
): GeneratedCoach {
  const { firstName, lastName } = nameGenerator.next();
  const id = crypto.randomUUID();
  const band = TIER_BANDS[spec.tier];
  const salaryOverride = ROLE_SALARY_OVERRIDES[spec.role];
  const salaryMin = salaryOverride?.salaryMin ?? band.salaryMin;
  const salaryMax = salaryOverride?.salaryMax ?? band.salaryMax;

  const age = intInRange(random, band.ageMin, band.ageMax);
  const contractYears = intInRange(random, band.yearsMin, band.yearsMax);
  const salarySteps = Math.max(
    1,
    Math.floor((salaryMax - salaryMin) / 50_000),
  );
  const contractSalary = salaryMin +
    intInRange(random, 0, salarySteps) * 50_000;
  const buyoutYears = intInRange(
    random,
    band.buyoutYearsMin,
    band.buyoutYearsMax,
  );
  const contractBuyout = contractSalary * buyoutYears;

  const tenureYears = intInRange(random, band.tenureMin, band.tenureMax);
  const hiredAt = new Date(anchor);
  hiredAt.setUTCFullYear(hiredAt.getUTCFullYear() - tenureYears);

  const collegeId = collegeIds.length > 0
    ? collegeIds[collegeIndex.value++ % collegeIds.length]
    : null;

  const tendencies = buildTendencies(spec.role, id);

  return {
    id,
    leagueId,
    teamId,
    firstName,
    lastName,
    role: spec.role,
    reportsToId,
    playCaller: spec.role === "HC" ? "offense" : null,
    age,
    hiredAt,
    contractYears,
    contractSalary,
    contractBuyout,
    collegeId,
    specialty: spec.specialty,
    isVacancy: false,
    mentorCoachId: null,
    ...(tendencies ? { tendencies } : {}),
  };
}

function wireMentors(
  coaches: GeneratedCoach[],
  random: () => number,
): void {
  const hcIds = coaches.filter((c) => c.role === "HC").map((c) => c.id);
  const coordinatorIds = coaches
    .filter((c) => COORDINATOR_ROLES.has(c.role))
    .map((c) => c.id);

  if (hcIds.length === 0 && coordinatorIds.length === 0) return;

  for (const coach of coaches) {
    if (coach.role === "HC") continue;
    if (random() < 0.5) continue;

    if (COORDINATOR_ROLES.has(coach.role) && hcIds.length > 0) {
      coach.mentorCoachId = hcIds[intInRange(random, 0, hcIds.length - 1)];
    } else if (coordinatorIds.length > 0) {
      coach.mentorCoachId =
        coordinatorIds[intInRange(random, 0, coordinatorIds.length - 1)];
    }
  }
}

export function createCoachesGenerator(
  options: CoachesGeneratorOptions = {},
): CoachesGenerator {
  const random = options.random ?? Math.random;
  const nameGenerator = options.nameGenerator ?? createNameGenerator();
  const now = options.now ?? (() => new Date());

  return {
    generate(input: CoachesGeneratorInput): GeneratedCoach[] {
      const coaches: GeneratedCoach[] = [];
      const anchor = now();
      const collegeIndex = { value: 0 };
      const collegeIds = input.collegeIds ?? [];

      for (const teamId of input.teamIds) {
        const idsByRole = new Map<CoachRole, string>();
        const teamCoaches: GeneratedCoach[] = [];

        for (const spec of STAFF_BLUEPRINT) {
          const reportsToId = spec.reportsTo === null
            ? null
            : idsByRole.get(spec.reportsTo) ?? null;

          const coach = generateCoach(
            spec,
            input.leagueId,
            teamId,
            reportsToId,
            random,
            nameGenerator,
            anchor,
            collegeIds,
            collegeIndex,
          );

          idsByRole.set(spec.role, coach.id);
          teamCoaches.push(coach);
        }

        // Fix up reportsToId: we generate HC first, so coordinators can
        // reference it, but we need a second pass to assign reportsToId
        // for roles whose parent was generated later in the blueprint.
        for (const coach of teamCoaches) {
          const spec = STAFF_BLUEPRINT.find((s) => s.role === coach.role)!;
          if (spec.reportsTo !== null) {
            coach.reportsToId = idsByRole.get(spec.reportsTo) ?? null;
          }
        }

        coaches.push(...teamCoaches);
      }

      wireMentors(coaches, random);

      return coaches;
    },

    generatePool(input: CoachesPoolInput): GeneratedCoach[] {
      if (input.numberOfTeams === 0) return [];

      const coaches: GeneratedCoach[] = [];
      const anchor = now();
      const collegeIndex = { value: 0 };
      const collegeIds = input.collegeIds ?? [];

      const countPerRole = Math.ceil(
        input.numberOfTeams * POOL_MULTIPLIER,
      );

      for (const spec of STAFF_BLUEPRINT) {
        for (let i = 0; i < countPerRole; i++) {
          const coach = generateCoach(
            spec,
            input.leagueId,
            null,
            null,
            random,
            nameGenerator,
            anchor,
            collegeIds,
            collegeIndex,
          );
          coaches.push(coach);
        }
      }

      wireMentors(coaches, random);

      return coaches;
    },
  };
}
