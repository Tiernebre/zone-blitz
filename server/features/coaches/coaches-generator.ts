import type {
  CoachPlayCaller,
  CoachRatingValues,
  CoachRole,
  CoachSpecialty,
  PositionGroup,
} from "@zone-blitz/shared";
import { COACH_RATING_KEYS } from "@zone-blitz/shared";
import {
  createNameGenerator,
  type NameGenerator,
} from "../../shared/name-generator.ts";
import type {
  CoachesGenerator,
  CoachesGeneratorInput,
  CoachesPoolInput,
  GeneratedCoach,
  GeneratedCoachRatings,
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
  /** Total career experience band in years, inclusive. Clamped at roll
   * time to `age - CAREER_START_AGE` so experience never exceeds what's
   * biographically possible. */
  experienceMin: number;
  experienceMax: number;
}

const CAREER_START_AGE = 22;

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
    experienceMin: 20,
    experienceMax: 35,
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
    experienceMin: 12,
    experienceMax: 28,
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
    experienceMin: 5,
    experienceMax: 20,
  },
};

// Role-tier-specific mean rating values. Each entry is the expected
// midpoint for a tier; a roll spreads ±RATING_SPREAD around it, then is
// clamped to 1..99. HCs emphasize leadership + gameManagement;
// coordinators emphasize schemeMastery; position coaches emphasize
// playerDevelopment. These are calibration handles — adjust as we tune.
const RATING_MEANS: Record<Tier, CoachRatingValues> = {
  HC: {
    leadership: 66,
    gameManagement: 64,
    schemeMastery: 55,
    playerDevelopment: 52,
    adaptability: 58,
  },
  COORDINATOR: {
    leadership: 55,
    gameManagement: 58,
    schemeMastery: 66,
    playerDevelopment: 55,
    adaptability: 56,
  },
  POSITION: {
    leadership: 50,
    gameManagement: 46,
    schemeMastery: 52,
    playerDevelopment: 62,
    adaptability: 52,
  },
};
const RATING_SPREAD = 22;
const RATING_MIN = 1;
const RATING_MAX = 99;

function rollRatingAroundMean(random: () => number, mean: number): number {
  const offset = Math.floor(random() * (RATING_SPREAD * 2 + 1)) - RATING_SPREAD;
  const value = mean + offset;
  if (value < RATING_MIN) return RATING_MIN;
  if (value > RATING_MAX) return RATING_MAX;
  return value;
}

/**
 * Young-coach ceiling gap. Converts the coach's position within their
 * tier age band into an age ratio (0 = youngest, 1 = oldest), then
 * returns a max ceiling headroom — young coaches can have large hidden
 * upside, vets sit near their current value. A small floor keeps even
 * vets from being completely stagnant.
 */
function ceilingHeadroom(
  random: () => number,
  age: number,
  band: TierBand,
): number {
  const span = Math.max(1, band.ageMax - band.ageMin);
  const ageRatio = Math.min(1, Math.max(0, (age - band.ageMin) / span));
  const maxGap = Math.round((1 - ageRatio) * 30) + 3; // 3..33
  return Math.floor(random() * (maxGap + 1));
}

function rollRatings(
  random: () => number,
  tier: Tier,
  age: number,
  band: TierBand,
): GeneratedCoachRatings {
  const means = RATING_MEANS[tier];
  const current = {} as CoachRatingValues;
  const ceiling = {} as CoachRatingValues;
  for (const key of COACH_RATING_KEYS) {
    const c = rollRatingAroundMean(random, means[key]);
    const gap = ceilingHeadroom(random, age, band);
    const ceil = Math.min(RATING_MAX, c + gap);
    current[key] = c;
    ceiling[key] = ceil;
  }

  // growthRate: younger coaches tend to grow faster. Same age-ratio
  // conversion — youngest get ~75, oldest get ~30, with noise.
  const span = Math.max(1, band.ageMax - band.ageMin);
  const ageRatio = Math.min(1, Math.max(0, (age - band.ageMin) / span));
  const baseGrowth = Math.round(75 - ageRatio * 40);
  const growthNoise = Math.floor(random() * 15) - 7;
  const growthRate = Math.min(95, Math.max(10, baseGrowth + growthNoise));

  return { current, ceiling, growthRate };
}

function buildTendencies(
  role: CoachRole,
  specialty: CoachSpecialty,
  seed: string,
): GeneratedCoachTendencies | null {
  const offensiveSide = role === "OC" ||
    (role === "HC" && specialty === "offense");
  const defensiveSide = role === "DC" ||
    (role === "HC" && specialty === "defense");
  if (offensiveSide) {
    return {
      offense: offensiveVectorFromArchetype(
        pickOffensiveArchetype(seed),
        seed,
      ),
    };
  }
  if (defensiveSide) {
    return {
      defense: defensiveVectorFromArchetype(
        pickDefensiveArchetype(seed),
        seed,
      ),
    };
  }
  return null;
}

const HC_SPECIALTY_DISTRIBUTION: ReadonlyArray<
  { specialty: CoachSpecialty; weight: number }
> = [
  { specialty: "offense", weight: 0.4 },
  { specialty: "defense", weight: 0.4 },
  { specialty: "ceo", weight: 0.2 },
];

function rollHcSpecialty(random: () => number): CoachSpecialty {
  const r = random();
  let cumulative = 0;
  for (const entry of HC_SPECIALTY_DISTRIBUTION) {
    cumulative += entry.weight;
    if (r < cumulative) return entry.specialty;
  }
  return HC_SPECIALTY_DISTRIBUTION[HC_SPECIALTY_DISTRIBUTION.length - 1]
    .specialty;
}

function playCallerForHc(specialty: CoachSpecialty): CoachPlayCaller {
  if (specialty === "offense") return "offense";
  if (specialty === "defense") return "defense";
  return "ceo";
}

/**
 * Map each offensive / defensive side-of-ball to the position groups a
 * coach on that side would plausibly have come up through. Used to roll
 * `positionBackground` for HCs and coordinators whose own record tracks
 * side-of-ball rather than a single position.
 */
const OFFENSIVE_POSITION_GROUPS: ReadonlyArray<PositionGroup> = [
  "QB",
  "RB",
  "WR",
  "TE",
  "OL",
];
const DEFENSIVE_POSITION_GROUPS: ReadonlyArray<PositionGroup> = [
  "DL",
  "LB",
  "DB",
];

function pickFromArray<T>(random: () => number, values: ReadonlyArray<T>): T {
  return values[Math.floor(random() * values.length)];
}

/**
 * Position-coach roles map 1:1 to a position group — a QBs coach came
 * up through QBs. HC/OC/DC/STC roll a position group consistent with
 * the side of ball their career sits on; CEO HCs come back as
 * `GENERALIST` because their value is organizational, not positional.
 */
function positionBackgroundFor(
  role: CoachRole,
  specialty: CoachSpecialty,
  random: () => number,
): PositionGroup {
  switch (role) {
    case "QB":
      return "QB";
    case "RB":
      return "RB";
    case "WR":
      return "WR";
    case "TE":
      return "TE";
    case "OL":
      return "OL";
    case "DL":
      return "DL";
    case "LB":
      return "LB";
    case "DB":
      return "DB";
    case "STC":
    case "ST_ASSISTANT":
      return "ST";
    case "OC":
      return pickFromArray(random, OFFENSIVE_POSITION_GROUPS);
    case "DC":
      return pickFromArray(random, DEFENSIVE_POSITION_GROUPS);
    case "HC":
      if (specialty === "offense") {
        return pickFromArray(random, OFFENSIVE_POSITION_GROUPS);
      }
      if (specialty === "defense") {
        return pickFromArray(random, DEFENSIVE_POSITION_GROUPS);
      }
      return "GENERALIST";
  }
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

interface CoachPreferences {
  marketTierPref: number;
  philosophyFitPref: number;
  staffFitPref: number;
  compensationPref: number;
  minimumThreshold: number;
}

function rollPreferences(random: () => number): CoachPreferences {
  return {
    marketTierPref: intInRange(random, 0, 100),
    philosophyFitPref: intInRange(random, 0, 100),
    staffFitPref: intInRange(random, 0, 100),
    compensationPref: intInRange(random, 0, 100),
    minimumThreshold: intInRange(random, 0, 100),
  };
}

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
  preferences: CoachPreferences | null,
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

  const experienceCeiling = Math.max(0, age - CAREER_START_AGE);
  const yearsExperience = Math.min(
    experienceCeiling,
    intInRange(random, band.experienceMin, band.experienceMax),
  );

  const collegeId = collegeIds.length > 0
    ? collegeIds[collegeIndex.value++ % collegeIds.length]
    : null;

  const specialty = spec.role === "HC"
    ? rollHcSpecialty(random)
    : spec.specialty;
  const tendencies = buildTendencies(spec.role, specialty, id);
  const ratings = rollRatings(random, spec.tier, age, band);
  const positionBackground = positionBackgroundFor(
    spec.role,
    specialty,
    random,
  );

  return {
    id,
    leagueId,
    teamId,
    firstName,
    lastName,
    role: spec.role,
    reportsToId,
    playCaller: spec.role === "HC" ? playCallerForHc(specialty) : null,
    age,
    yearsExperience,
    hiredAt,
    contractYears,
    contractSalary,
    contractBuyout,
    collegeId,
    specialty,
    positionBackground,
    isVacancy: false,
    mentorCoachId: null,
    marketTierPref: preferences?.marketTierPref ?? null,
    philosophyFitPref: preferences?.philosophyFitPref ?? null,
    staffFitPref: preferences?.staffFitPref ?? null,
    compensationPref: preferences?.compensationPref ?? null,
    minimumThreshold: preferences?.minimumThreshold ?? null,
    ratings,
    ...(tendencies ? { tendencies } : {}),
  };
}

const TIER_ORDER: Record<string, number> = {
  HC: 0,
  COORDINATOR: 1,
  POSITION: 2,
};

function tierForRole(role: CoachRole): number {
  if (role === "HC") return TIER_ORDER.HC;
  if (COORDINATOR_ROLES.has(role)) return TIER_ORDER.COORDINATOR;
  return TIER_ORDER.POSITION;
}

function sortMentorsFirst(coaches: GeneratedCoach[]): void {
  coaches.sort((a, b) => tierForRole(a.role) - tierForRole(b.role));
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
            null,
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
      sortMentorsFirst(coaches);

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
            rollPreferences(random),
          );
          coaches.push(coach);
        }
      }

      wireMentors(coaches, random);
      sortMentorsFirst(coaches);

      return coaches;
    },
  };
}
