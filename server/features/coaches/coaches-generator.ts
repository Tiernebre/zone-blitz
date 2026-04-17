import type {
  CoachPlayCaller,
  CoachRatingValues,
  CoachRole,
  CoachSpecialty,
  PositionGroup,
} from "@zone-blitz/shared";
import {
  COACH_RATING_KEYS,
  distributeByWeight,
  intInRange,
  triangularInt,
} from "@zone-blitz/shared";
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
  /** Most-common age (mode) for the triangular age distribution. Keeps
   * the population shaped like the real NFL — a peak around the mode
   * with genuinely young and genuinely old coaches appearing in the
   * tails, instead of a flat uniform roll that clusters every coach in
   * the middle of a narrow band. */
  ageMode: number;
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
    ageMin: 36,
    ageMax: 68,
    ageMode: 51,
    salaryMin: 6_000_000,
    salaryMax: 14_000_000,
    // Contract length for coaches is rolled via CONTRACT_LENGTH_WEIGHTS
    // (weighted mode-aware), not by uniform intInRange on this band. These
    // bounds are retained as documentation of the realistic range. See #543.
    yearsMin: 3,
    yearsMax: 6,
    buyoutYearsMin: 1,
    buyoutYearsMax: 2,
    tenureMin: 0,
    tenureMax: 4,
    experienceMin: 8,
    experienceMax: 40,
  },
  COORDINATOR: {
    ageMin: 30,
    ageMax: 62,
    ageMode: 44,
    salaryMin: 1_000_000,
    salaryMax: 5_000_000,
    yearsMin: 2,
    yearsMax: 4,
    buyoutYearsMin: 1,
    buyoutYearsMax: 2,
    tenureMin: 0,
    tenureMax: 3,
    experienceMin: 4,
    experienceMax: 32,
  },
  POSITION: {
    ageMin: 26,
    ageMax: 62,
    ageMode: 40,
    salaryMin: 400_000,
    salaryMax: 1_400_000,
    yearsMin: 1,
    yearsMax: 3,
    buyoutYearsMin: 0,
    buyoutYearsMax: 1,
    tenureMin: 0,
    tenureMax: 3,
    experienceMin: 2,
    experienceMax: 30,
  },
};

// All coach ratings are drawn from a bell curve centered on 50 — the
// league-average midpoint mandated by the rating-scale contract
// (see docs/product/north-star/player-attributes.md). Role specialization
// is expressed as a *small* tilt (+4) on role-relevant ratings rather than
// a shifted mean, so a population of coaches averages 50 league-wide and
// the full 0–99 scale carries meaning. Elite HCs and McVay-type
// coordinators emerge from the tail of the bell, not from a pre-loaded
// mean.
const ROLE_TILT = 4;
const TIER_TILTS: Record<Tier, Partial<CoachRatingValues>> = {
  HC: { leadership: ROLE_TILT, gameManagement: ROLE_TILT },
  COORDINATOR: { schemeMastery: ROLE_TILT },
  POSITION: { playerDevelopment: ROLE_TILT },
};

const BASE_RATING_MEAN = 50;
const RATING_MIN = 1;
const RATING_MAX = 99;

/**
 * Irwin–Hall n=3 — sum of three uniforms, normalized. Produces a
 * bell-shaped distribution with mean 0.5 and stddev ≈ 0.167.
 */
function bellSample(random: () => number): number {
  return (random() + random() + random()) / 3;
}

/**
 * Rolls a rating around the 50 midpoint using a bell-curve sample, then
 * applies a per-tier role tilt. Stddev ≈ 10 at the default scale — wide
 * enough for meaningful variance, narrow enough that elite (80+) and poor
 * (20−) coaches are genuinely rare.
 */
const RATING_SCALE = 60;

function rollRatingAroundMean(random: () => number, tilt: number): number {
  const bell = bellSample(random) - 0.5; // -0.5..0.5, mean 0
  const value = Math.round(BASE_RATING_MEAN + tilt + bell * RATING_SCALE);
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
  const tilts = TIER_TILTS[tier];
  const current = {} as CoachRatingValues;
  const ceiling = {} as CoachRatingValues;
  for (const key of COACH_RATING_KEYS) {
    const tilt = tilts[key] ?? 0;
    const c = rollRatingAroundMean(random, tilt);
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

// Pool sizing is driven by tier-level per-team counts rather than a flat
// multiplier per blueprint role. The numbers reflect the initial staffing
// phase the game presents at league creation — teams compete over roughly
// this many candidates per team, with sub-roles within each tier distributed
// by NFL-realistic weights (defined below).
const HC_POOL_PER_TEAM = 2;
const COORDINATOR_POOL_PER_TEAM = 4;
const POSITION_POOL_PER_TEAM = 6;

const COORDINATOR_ROLES = new Set<CoachRole>(["OC", "DC", "STC"]);

const COORDINATOR_WEIGHTS: ReadonlyArray<{ key: CoachRole; weight: number }> = [
  { key: "OC", weight: 1 },
  { key: "DC", weight: 1 },
  { key: "STC", weight: 1 },
];

// Position-coach weights track real-NFL staff composition: OL, LB, and DB
// rooms typically carry two coaches (head + assistant or inside/outside
// split); other position groups run with a single coach.
const POSITION_WEIGHTS: ReadonlyArray<{ key: CoachRole; weight: number }> = [
  { key: "QB", weight: 1 },
  { key: "RB", weight: 1 },
  { key: "WR", weight: 1 },
  { key: "TE", weight: 1 },
  { key: "OL", weight: 2 },
  { key: "DL", weight: 1 },
  { key: "LB", weight: 2 },
  { key: "DB", weight: 2 },
  { key: "ST_ASSISTANT", weight: 1 },
];

interface RoleExperienceSplit {
  headCoachYears: number;
  coordinatorYears: number;
  positionCoachYears: number;
}

/**
 * Split a coach's total career `yearsExperience` across the three career
 * tiers they've held. The current tier is where most of their recent years
 * are concentrated; earlier years filter down to lower tiers.
 *
 * - **HC tier**: some years as HC (weighted toward 0–3 so first-time head
 *   coaches are common), remainder split across coordinator and position
 *   coach buckets.
 * - **COORDINATOR tier**: no HC years; most years as a coordinator, a
 *   smaller amount carried back into the position-coach bucket.
 * - **POSITION tier**: all years concentrate in `positionCoachYears`.
 *
 * The three returned fields always sum to `yearsExperience`.
 */
/**
 * Contract length distributions per tier. Real NFL contracts cluster
 * heavily at modal lengths rather than spreading uniformly across the
 * tier's min/max band: HCs are almost always signed to 5-year deals,
 * coordinators to 3-year deals, and position coaches to 2-year deals.
 * A uniform roll across `yearsMin..yearsMax` underweighted the mode and
 * overproduced short contracts — e.g., ~33% of HCs on 3-year deals,
 * which is essentially unseen in the modern league. These weights honor
 * the mode while still leaving tails for the occasional longer or
 * shorter deal. See #543.
 */
const CONTRACT_LENGTH_WEIGHTS: Record<
  Tier,
  ReadonlyArray<{ years: number; weight: number }>
> = {
  HC: [
    { years: 3, weight: 0.10 },
    { years: 4, weight: 0.20 },
    { years: 5, weight: 0.55 },
    { years: 6, weight: 0.15 },
  ],
  COORDINATOR: [
    { years: 2, weight: 0.25 },
    { years: 3, weight: 0.55 },
    { years: 4, weight: 0.20 },
  ],
  POSITION: [
    { years: 1, weight: 0.20 },
    { years: 2, weight: 0.55 },
    { years: 3, weight: 0.25 },
  ],
};

function pickWeighted<T>(
  random: () => number,
  options: ReadonlyArray<{ value: T; weight: number }>,
): T {
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let roll = random() * total;
  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) return option.value;
  }
  return options[options.length - 1].value;
}

function pickContractYears(tier: Tier, random: () => number): number {
  const weights = CONTRACT_LENGTH_WEIGHTS[tier];
  return pickWeighted(
    random,
    weights.map((w) => ({ value: w.years, weight: w.weight })),
  );
}

/**
 * First-time HC probability by age bucket. Modern NFL first-time HCs
 * overwhelmingly come from the mid-30s to mid-40s coaching tree — McVay
 * (30), Steichen (37), Ben Johnson (38), LaFleur (39), Shanahan (37).
 * First-timers in their 50s exist but are rare; first-timers 55+ are
 * effectively unheard of. A flat 35% roll produced 65-year-old first-
 * time HCs, which is not a realistic hiring market. See #543.
 */
function firstTimeHcProbability(age: number): number {
  if (age < 45) return 0.50;
  if (age < 55) return 0.20;
  return 0.05;
}

function rollRoleExperience(
  tier: Tier,
  yearsExperience: number,
  random: () => number,
  age: number,
): RoleExperienceSplit {
  if (yearsExperience <= 0) {
    return { headCoachYears: 0, coordinatorYears: 0, positionCoachYears: 0 };
  }
  if (tier === "POSITION") {
    return {
      headCoachYears: 0,
      coordinatorYears: 0,
      positionCoachYears: yearsExperience,
    };
  }
  if (tier === "COORDINATOR") {
    const coordinatorYears = triangularInt(
      random,
      0,
      Math.min(6, yearsExperience),
      yearsExperience,
    );
    return {
      headCoachYears: 0,
      coordinatorYears,
      positionCoachYears: yearsExperience - coordinatorYears,
    };
  }
  const maxHc = Math.min(yearsExperience, 18);
  // First-time HC probability is age-gated (see firstTimeHcProbability).
  // Young candidates are overwhelmingly first-timers; older candidates have
  // almost certainly already been in the chair somewhere. This preserves a
  // realistic "proven vs unproven" pool shape while eliminating the
  // implausible 60+-year-old first-time HC. See #543.
  const headCoachYears = random() < firstTimeHcProbability(age)
    ? 0
    : triangularInt(random, 1, Math.min(3, maxHc), Math.max(1, maxHc));
  const remaining = yearsExperience - headCoachYears;
  const coordinatorYears = remaining <= 0
    ? 0
    : triangularInt(random, 0, Math.min(5, remaining), remaining);
  const positionCoachYears = remaining - coordinatorYears;
  return { headCoachYears, coordinatorYears, positionCoachYears };
}

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

  const age = triangularInt(random, band.ageMin, band.ageMode, band.ageMax);
  const contractYears = pickContractYears(spec.tier, random);
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
  const roleExperience = rollRoleExperience(
    spec.tier,
    yearsExperience,
    random,
    age,
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
    headCoachYears: roleExperience.headCoachYears,
    coordinatorYears: roleExperience.coordinatorYears,
    positionCoachYears: roleExperience.positionCoachYears,
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

      const N = input.numberOfTeams;
      const roleCounts = new Map<CoachRole, number>();
      roleCounts.set("HC", HC_POOL_PER_TEAM * N);
      for (
        const [role, count] of distributeByWeight(
          COORDINATOR_POOL_PER_TEAM * N,
          COORDINATOR_WEIGHTS,
        )
      ) {
        roleCounts.set(role, count);
      }
      for (
        const [role, count] of distributeByWeight(
          POSITION_POOL_PER_TEAM * N,
          POSITION_WEIGHTS,
        )
      ) {
        roleCounts.set(role, count);
      }

      for (const spec of STAFF_BLUEPRINT) {
        const count = roleCounts.get(spec.role) ?? 0;
        for (let i = 0; i < count; i++) {
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
