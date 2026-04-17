import type {
  PositionGroup,
  ScoutRatingValues,
  ScoutRegion,
  ScoutRole,
} from "@zone-blitz/shared";
import {
  distributeByWeight,
  intInRange,
  SCOUT_RATING_KEYS,
  triangularInt,
} from "@zone-blitz/shared";
import {
  createNameGenerator,
  type NameGenerator,
} from "../../shared/name-generator.ts";
import type {
  GeneratedScout,
  GeneratedScoutRatings,
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

// Pool sizing is tier-driven: directors vs. non-directors. Non-director
// weights mirror NFL scouting staffs — roughly 1 cross-checker per 3 area
// scouts — then split across East/West (cross-checkers) and the four
// regions (area scouts) so league coverage is preserved in aggregate.
const DIRECTOR_POOL_PER_TEAM = 2;
const NON_DIRECTOR_POOL_PER_TEAM = 4;

const NON_DIRECTOR_WEIGHTS: ReadonlyArray<
  { key: BlueprintKey; weight: number }
> = [
  { key: "EAST_CC", weight: 0.5 },
  { key: "WEST_CC", weight: 0.5 },
  { key: "AREA_NE", weight: 0.75 },
  { key: "AREA_SE", weight: 0.75 },
  { key: "AREA_MW", weight: 0.75 },
  { key: "AREA_W", weight: 0.75 },
];

interface RoleBand {
  ageMin: number;
  ageMax: number;
  /** Most-common age (mode) for the triangular age distribution. Keeps
   * the pool NFL-shaped with real tails (young cross-checkers, career
   * area scouts well into their 50s) instead of a flat uniform roll
   * that clusters everyone near the band's midpoint. */
  ageMode: number;
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
  /** Total career experience in years, inclusive. Clamped at roll time
   * to `age - CAREER_START_AGE`. */
  experienceMin: number;
  experienceMax: number;
}

const CAREER_START_AGE = 22;

const ROLE_BANDS: Record<ScoutRole, RoleBand> = {
  DIRECTOR: {
    ageMin: 40,
    ageMax: 70,
    ageMode: 54,
    salaryMin: 250_000,
    salaryMax: 800_000,
    yearsMin: 3,
    yearsMax: 5,
    buyoutYearsMin: 1,
    buyoutYearsMax: 2,
    workCapacityMin: 160,
    workCapacityMax: 240,
    tenureMin: 0,
    tenureMax: 5,
    experienceMin: 12,
    experienceMax: 40,
  },
  NATIONAL_CROSS_CHECKER: {
    ageMin: 32,
    ageMax: 64,
    ageMode: 46,
    salaryMin: 150_000,
    salaryMax: 400_000,
    yearsMin: 2,
    yearsMax: 4,
    buyoutYearsMin: 0,
    buyoutYearsMax: 1,
    workCapacityMin: 140,
    workCapacityMax: 220,
    tenureMin: 0,
    tenureMax: 4,
    experienceMin: 6,
    experienceMax: 30,
  },
  AREA_SCOUT: {
    ageMin: 25,
    ageMax: 58,
    ageMode: 36,
    salaryMin: 80_000,
    salaryMax: 200_000,
    yearsMin: 1,
    yearsMax: 3,
    buyoutYearsMin: 0,
    buyoutYearsMax: 1,
    workCapacityMin: 80,
    workCapacityMax: 160,
    tenureMin: 0,
    tenureMax: 3,
    experienceMin: 1,
    experienceMax: 25,
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

/**
 * Position-group options for any scout — area scout, cross-checker, or
 * director. Most scouts build up deeper reps on a specific position group
 * over their career (an area scout who spent years on Big Ten OL, a
 * director who rose through DB evaluation), so each of the eight groups
 * gets an equal shot alongside a single `GENERALIST` bucket for the true
 * all-position evaluators and pure board-builders.
 */
const POSITION_FOCUS_POOL: ReadonlyArray<PositionGroup> = [
  "GENERALIST",
  "QB",
  "RB",
  "WR",
  "TE",
  "OL",
  "DL",
  "LB",
  "DB",
];

/** Regions an area scout can be rolled against. National is reserved
 * for directors / cross-checkers whose network spans every region. */
const AREA_REGIONS: ReadonlyArray<ScoutRegion> = [
  "NORTHEAST",
  "SOUTHEAST",
  "MIDWEST",
  "WEST",
];

function pickFromArray<T>(random: () => number, values: ReadonlyArray<T>): T {
  return values[Math.floor(random() * values.length)];
}

/**
 * Rolls the position-focus value a scout is hireable on. All scouts —
 * including directors, who are former area scouts who built their way up —
 * draw from the same pool: one generalist slot and eight position-group
 * slots with equal weight. This gives hiring managers a meaningful fit
 * decision (a DB-focus director builds a different board than a QB-focus
 * one) instead of every director reading as an interchangeable generalist.
 */
function rollPositionFocus(
  _role: ScoutRole,
  random: () => number,
): PositionGroup {
  return pickFromArray(random, POSITION_FOCUS_POOL);
}

/**
 * Rolls the region this scout's network is strongest in. Directors
 * come back with an earlier-career region — a director who rose
 * through the Southeast brings that network with them — while
 * cross-checkers default to NATIONAL unless their current coverage
 * already implies a sub-region. Area scouts line up with whatever
 * region they currently staff.
 */
function rollRegionFocus(
  role: ScoutRole,
  coverage: string | null,
  random: () => number,
): ScoutRegion {
  if (role === "AREA_SCOUT") {
    return coverageToRegion(coverage) ?? pickFromArray(random, AREA_REGIONS);
  }
  if (role === "NATIONAL_CROSS_CHECKER") {
    return "NATIONAL";
  }
  // Directors bring a career-origin region with them.
  return pickFromArray(random, AREA_REGIONS);
}

// Hidden scout ratings follow the same Geno Smith Line scale contract
// as coach ratings (see `docs/product/north-star/player-attributes.md`):
// 50 is the Mendoza line, 70+ franchise-caliber, 85+ elite, 95+
// generational. Means cluster on 50 with a right-skewed bell generated
// from an Irwin-Hall n=3 sample; role tilts are kept small so the
// population average stays at 50 and the full 0-99 scale carries
// meaning. Elite evaluators emerge from the bell's tail — not from a
// pre-loaded mean.
const BASE_RATING_MEAN = 50;
const RATING_MIN = 1;
const RATING_MAX = 99;
const RATING_SCALE = 60;
const ROLE_TILT = 4;

const SCOUT_ROLE_TILTS: Record<ScoutRole, Partial<ScoutRatingValues>> = {
  DIRECTOR: { accuracy: ROLE_TILT, intangibleRead: ROLE_TILT },
  NATIONAL_CROSS_CHECKER: { accuracy: ROLE_TILT, biasResistance: ROLE_TILT },
  AREA_SCOUT: { projection: ROLE_TILT },
};

function bellSample(random: () => number): number {
  return (random() + random() + random()) / 3;
}

function rollScoutRating(random: () => number, tilt: number): number {
  const bell = bellSample(random) - 0.5;
  const value = Math.round(BASE_RATING_MEAN + tilt + bell * RATING_SCALE);
  if (value < RATING_MIN) return RATING_MIN;
  if (value > RATING_MAX) return RATING_MAX;
  return value;
}

function scoutCeilingHeadroom(
  random: () => number,
  age: number,
  band: RoleBand,
): number {
  const span = Math.max(1, band.ageMax - band.ageMin);
  const ageRatio = Math.min(1, Math.max(0, (age - band.ageMin) / span));
  const maxGap = Math.round((1 - ageRatio) * 30) + 3;
  return Math.floor(random() * (maxGap + 1));
}

function rollScoutRatings(
  random: () => number,
  role: ScoutRole,
  age: number,
  band: RoleBand,
): GeneratedScoutRatings {
  const tilts = SCOUT_ROLE_TILTS[role];
  const current = {} as ScoutRatingValues;
  const ceiling = {} as ScoutRatingValues;
  for (const key of SCOUT_RATING_KEYS) {
    const tilt = tilts[key] ?? 0;
    const c = rollScoutRating(random, tilt);
    const gap = scoutCeilingHeadroom(random, age, band);
    current[key] = c;
    ceiling[key] = Math.min(RATING_MAX, c + gap);
  }

  // Younger scouts grow faster. Same age-ratio conversion coaches use
  // — youngest get ~75, oldest ~30, with noise.
  const span = Math.max(1, band.ageMax - band.ageMin);
  const ageRatio = Math.min(1, Math.max(0, (age - band.ageMin) / span));
  const baseGrowth = Math.round(75 - ageRatio * 40);
  const growthNoise = Math.floor(random() * 15) - 7;
  const growthRate = Math.min(95, Math.max(10, baseGrowth + growthNoise));

  return { current, ceiling, growthRate };
}

function coverageToRegion(coverage: string | null): ScoutRegion | null {
  switch (coverage) {
    case "Northeast":
      return "NORTHEAST";
    case "Southeast":
      return "SOUTHEAST";
    case "Midwest":
      return "MIDWEST";
    case "West Coast":
      return "WEST";
    default:
      return null;
  }
}

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
          const age = triangularInt(
            random,
            band.ageMin,
            band.ageMode,
            band.ageMax,
          );
          const contractYears = intInRange(
            random,
            band.yearsMin,
            band.yearsMax,
          );
          // 10k step so the tightened salary bands (e.g. area scout
          // $80K–$200K) can reach their ceiling with meaningful variance.
          const salarySteps = Math.max(
            1,
            Math.floor((band.salaryMax - band.salaryMin) / 10_000),
          );
          const contractSalary = band.salaryMin +
            intInRange(random, 0, salarySteps) * 10_000;
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

          const yearsExperience = Math.min(
            Math.max(0, age - CAREER_START_AGE),
            intInRange(random, band.experienceMin, band.experienceMax),
          );

          const positionFocus = rollPositionFocus(spec.role, random);
          const regionFocus = rollRegionFocus(
            spec.role,
            spec.coverage,
            random,
          );

          const ratings = rollScoutRatings(random, spec.role, age, band);

          scouts.push({
            id,
            leagueId: input.leagueId,
            teamId,
            firstName,
            lastName,
            role: spec.role,
            reportsToId,
            coverage: spec.coverage,
            positionFocus,
            regionFocus,
            age,
            yearsExperience,
            hiredAt,
            contractYears,
            contractSalary,
            contractBuyout,
            workCapacity,
            isVacancy: false,
            ...NULL_PREFERENCES,
            ratings,
          });
        }
      }

      return scouts;
    },

    generatePool(input: ScoutsPoolInput): GeneratedScout[] {
      if (input.numberOfTeams === 0) return [];

      const scouts: GeneratedScout[] = [];
      const anchor = now();
      const N = input.numberOfTeams;
      const keyCounts = new Map<BlueprintKey, number>();
      keyCounts.set("DIRECTOR", DIRECTOR_POOL_PER_TEAM * N);
      for (
        const [key, count] of distributeByWeight(
          NON_DIRECTOR_POOL_PER_TEAM * N,
          NON_DIRECTOR_WEIGHTS,
        )
      ) {
        keyCounts.set(key, count);
      }

      for (const spec of STAFF_BLUEPRINT) {
        const count = keyCounts.get(spec.key) ?? 0;
        for (let i = 0; i < count; i++) {
          const { firstName, lastName } = nameGenerator.next();
          const id = crypto.randomUUID();

          const band = ROLE_BANDS[spec.role];
          const age = triangularInt(
            random,
            band.ageMin,
            band.ageMode,
            band.ageMax,
          );
          const contractYears = intInRange(
            random,
            band.yearsMin,
            band.yearsMax,
          );
          const salarySteps = Math.max(
            1,
            Math.floor((band.salaryMax - band.salaryMin) / 10_000),
          );
          const contractSalary = band.salaryMin +
            intInRange(random, 0, salarySteps) * 10_000;
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

          const yearsExperience = Math.min(
            Math.max(0, age - CAREER_START_AGE),
            intInRange(random, band.experienceMin, band.experienceMax),
          );

          const positionFocus = rollPositionFocus(spec.role, random);
          const regionFocus = rollRegionFocus(
            spec.role,
            spec.coverage,
            random,
          );

          const ratings = rollScoutRatings(random, spec.role, age, band);

          scouts.push({
            id,
            leagueId: input.leagueId,
            teamId: null,
            firstName,
            lastName,
            role: spec.role,
            reportsToId: null,
            coverage: spec.coverage,
            positionFocus,
            regionFocus,
            age,
            yearsExperience,
            hiredAt,
            contractYears,
            contractSalary,
            contractBuyout,
            workCapacity,
            isVacancy: false,
            ...rollPreferences(random),
            ratings,
          });
        }
      }

      return scouts;
    },
  };
}
