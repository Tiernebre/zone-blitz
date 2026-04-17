import { assertEquals, assertNotEquals } from "@std/assert";
import {
  COACH_RATING_KEYS,
  type CoachRole,
  mulberry32,
} from "@zone-blitz/shared";
import {
  createCoachesGenerator,
  type NameGenerator,
} from "./coaches-generator.ts";

const TEAM_IDS = ["team-1", "team-2", "team-3"];
const INPUT = {
  leagueId: "league-1",
  teamIds: TEAM_IDS,
};

const COACHES_PER_TEAM = 13;

const EXPECTED_ROLES: CoachRole[] = [
  "HC",
  "OC",
  "DC",
  "STC",
  "QB",
  "RB",
  "WR",
  "TE",
  "OL",
  "DL",
  "LB",
  "DB",
  "ST_ASSISTANT",
];

function seededRandom(seed: number): () => number {
  return mulberry32(seed);
}

function fixedNameGenerator(): NameGenerator {
  let i = 0;
  return {
    next() {
      i++;
      return { firstName: `First${i}`, lastName: `Last${i}` };
    },
  };
}

function makeGenerator(seed = 12345) {
  return createCoachesGenerator({
    random: seededRandom(seed),
    nameGenerator: fixedNameGenerator(),
  });
}

Deno.test("generates a full staff per team", () => {
  const result = makeGenerator().generate(INPUT);

  assertEquals(result.length, TEAM_IDS.length * COACHES_PER_TEAM);
  for (const teamId of TEAM_IDS) {
    const teamCoaches = result.filter((c) => c.teamId === teamId);
    assertEquals(teamCoaches.length, COACHES_PER_TEAM);
    const roles = new Set(teamCoaches.map((c) => c.role));
    for (const role of EXPECTED_ROLES) {
      assertEquals(roles.has(role), true, `team ${teamId} missing ${role}`);
    }
  }
});

Deno.test("each team has exactly one head coach", () => {
  const result = makeGenerator().generate(INPUT);
  for (const teamId of TEAM_IDS) {
    const hcs = result.filter((c) => c.teamId === teamId && c.role === "HC");
    assertEquals(hcs.length, 1);
  }
});

Deno.test("head coach has no reportsTo and non-null play caller", () => {
  const result = makeGenerator().generate(INPUT);
  const hcs = result.filter((c) => c.role === "HC");
  for (const hc of hcs) {
    assertEquals(hc.reportsToId, null);
    assertNotEquals(hc.playCaller, null);
  }
});

Deno.test("coordinators report to their head coach", () => {
  const result = makeGenerator().generate(INPUT);
  for (const teamId of TEAM_IDS) {
    const teamCoaches = result.filter((c) => c.teamId === teamId);
    const hc = teamCoaches.find((c) => c.role === "HC");
    const coordinators = teamCoaches.filter((c) =>
      c.role === "OC" || c.role === "DC" || c.role === "STC"
    );
    assertEquals(coordinators.length, 3);
    for (const coord of coordinators) {
      assertEquals(coord.reportsToId, hc?.id);
      assertEquals(coord.playCaller, null);
    }
  }
});

Deno.test("offensive position coaches report to OC", () => {
  const result = makeGenerator().generate(INPUT);
  const offensiveRoles: CoachRole[] = ["QB", "RB", "WR", "TE", "OL"];
  for (const teamId of TEAM_IDS) {
    const teamCoaches = result.filter((c) => c.teamId === teamId);
    const oc = teamCoaches.find((c) => c.role === "OC");
    for (const role of offensiveRoles) {
      const coach = teamCoaches.find((c) => c.role === role);
      assertEquals(coach?.reportsToId, oc?.id);
    }
  }
});

Deno.test("defensive position coaches report to DC", () => {
  const result = makeGenerator().generate(INPUT);
  const defensiveRoles: CoachRole[] = ["DL", "LB", "DB"];
  for (const teamId of TEAM_IDS) {
    const teamCoaches = result.filter((c) => c.teamId === teamId);
    const dc = teamCoaches.find((c) => c.role === "DC");
    for (const role of defensiveRoles) {
      const coach = teamCoaches.find((c) => c.role === role);
      assertEquals(coach?.reportsToId, dc?.id);
    }
  }
});

Deno.test("special teams assistant reports to STC", () => {
  const result = makeGenerator().generate(INPUT);
  for (const teamId of TEAM_IDS) {
    const teamCoaches = result.filter((c) => c.teamId === teamId);
    const stc = teamCoaches.find((c) => c.role === "STC");
    const sta = teamCoaches.find((c) => c.role === "ST_ASSISTANT");
    assertEquals(sta?.reportsToId, stc?.id);
  }
});

Deno.test("all coaches have the correct leagueId, non-empty names, plausible age", () => {
  const result = makeGenerator().generate(INPUT);
  for (const coach of result) {
    assertEquals(coach.leagueId, INPUT.leagueId);
    assertEquals(coach.firstName.length > 0, true);
    assertEquals(coach.lastName.length > 0, true);
    // Position-tier floor is 26 (TIER_BANDS.POSITION.ageMin); HC ceiling is 68.
    assertEquals(coach.age >= 26 && coach.age <= 75, true);
    assertEquals(coach.contractYears >= 1, true);
    assertEquals(coach.isVacancy, false);
  }
});

Deno.test("coaches have unique ids", () => {
  const result = makeGenerator().generate(INPUT);
  const ids = new Set(result.map((c) => c.id));
  assertEquals(ids.size, result.length);
});

Deno.test("coaches get a college when a pool is provided", () => {
  const collegeIds = ["college-a", "college-b"];
  const result = makeGenerator().generate({ ...INPUT, collegeIds });
  for (const coach of result) {
    assertEquals(collegeIds.includes(coach.collegeId ?? ""), true);
  }
});

Deno.test("coaches have null college when no pool is provided", () => {
  const result = makeGenerator().generate(INPUT);
  for (const coach of result) {
    assertEquals(coach.collegeId, null);
  }
});

Deno.test("generates no coaches when no teams provided", () => {
  const result = makeGenerator().generate({ leagueId: "l1", teamIds: [] });
  assertEquals(result.length, 0);
});

Deno.test("every OC carries a populated offensive tendency vector only", () => {
  const result = makeGenerator().generate(INPUT);
  const ocs = result.filter((c) => c.role === "OC");
  assertEquals(ocs.length, TEAM_IDS.length);
  for (const oc of ocs) {
    assertNotEquals(oc.tendencies, undefined);
    assertNotEquals(oc.tendencies?.offense, undefined);
    assertEquals(oc.tendencies?.defense, undefined);
    const values = Object.values(oc.tendencies!.offense!);
    assertEquals(values.length, 9);
    for (const v of values) {
      assertEquals(v >= 0 && v <= 100, true);
      assertEquals(Number.isInteger(v), true);
    }
  }
});

Deno.test("every DC carries a populated defensive tendency vector only", () => {
  const result = makeGenerator().generate(INPUT);
  const dcs = result.filter((c) => c.role === "DC");
  assertEquals(dcs.length, TEAM_IDS.length);
  for (const dc of dcs) {
    assertNotEquals(dc.tendencies, undefined);
    assertNotEquals(dc.tendencies?.defense, undefined);
    assertEquals(dc.tendencies?.offense, undefined);
    const values = Object.values(dc.tendencies!.defense!);
    assertEquals(values.length, 8);
    for (const v of values) {
      assertEquals(v >= 0 && v <= 100, true);
      assertEquals(Number.isInteger(v), true);
    }
  }
});

Deno.test("position coaches and STC carry no tendencies", () => {
  const result = makeGenerator().generate(INPUT);
  const noTendencyRoles = new Set<CoachRole>([
    "STC",
    "QB",
    "RB",
    "WR",
    "TE",
    "OL",
    "DL",
    "LB",
    "DB",
    "ST_ASSISTANT",
  ]);
  const noTendencyCoaches = result.filter((c) => noTendencyRoles.has(c.role));
  assertEquals(noTendencyCoaches.length > 0, true);
  for (const coach of noTendencyCoaches) {
    assertEquals(coach.tendencies, undefined);
  }
});

Deno.test("HC specialty is rolled across offense/defense/ceo", () => {
  const result = makeGenerator(99).generate({
    leagueId: "lg",
    teamIds: Array.from({ length: 60 }, (_, i) => `team-${i}`),
  });
  const hcs = result.filter((c) => c.role === "HC");
  const specialties = new Set(hcs.map((hc) => hc.specialty));
  assertEquals(specialties.has("offense"), true);
  assertEquals(specialties.has("defense"), true);
  assertEquals(specialties.has("ceo"), true);
});

Deno.test("HC playCaller follows specialty", () => {
  const result = makeGenerator(99).generate({
    leagueId: "lg",
    teamIds: Array.from({ length: 60 }, (_, i) => `team-${i}`),
  });
  const hcs = result.filter((c) => c.role === "HC");
  for (const hc of hcs) {
    if (hc.specialty === "offense") assertEquals(hc.playCaller, "offense");
    if (hc.specialty === "defense") assertEquals(hc.playCaller, "defense");
    if (hc.specialty === "ceo") assertEquals(hc.playCaller, "ceo");
  }
});

Deno.test("offense-oriented HCs carry offensive tendencies only", () => {
  const result = makeGenerator(99).generate({
    leagueId: "lg",
    teamIds: Array.from({ length: 60 }, (_, i) => `team-${i}`),
  });
  const offenseHcs = result.filter(
    (c) => c.role === "HC" && c.specialty === "offense",
  );
  assertEquals(offenseHcs.length > 0, true);
  for (const hc of offenseHcs) {
    assertNotEquals(hc.tendencies, undefined);
    assertNotEquals(hc.tendencies?.offense, undefined);
    assertEquals(hc.tendencies?.defense, undefined);
  }
});

Deno.test("defense-oriented HCs carry defensive tendencies only", () => {
  const result = makeGenerator(99).generate({
    leagueId: "lg",
    teamIds: Array.from({ length: 60 }, (_, i) => `team-${i}`),
  });
  const defenseHcs = result.filter(
    (c) => c.role === "HC" && c.specialty === "defense",
  );
  assertEquals(defenseHcs.length > 0, true);
  for (const hc of defenseHcs) {
    assertNotEquals(hc.tendencies, undefined);
    assertNotEquals(hc.tendencies?.defense, undefined);
    assertEquals(hc.tendencies?.offense, undefined);
  }
});

Deno.test("CEO HCs defer to coordinators (no tendencies)", () => {
  const result = makeGenerator(99).generate({
    leagueId: "lg",
    teamIds: Array.from({ length: 60 }, (_, i) => `team-${i}`),
  });
  const ceoHcs = result.filter(
    (c) => c.role === "HC" && c.specialty === "ceo",
  );
  assertEquals(ceoHcs.length > 0, true);
  for (const hc of ceoHcs) {
    assertEquals(hc.tendencies, undefined);
  }
});

// ---- Graduated-behaviour assertions ----

Deno.test("head coach ages span the HC tier band (~36-68)", () => {
  const result = makeGenerator().generate(INPUT);
  const hcs = result.filter((c) => c.role === "HC");
  for (const hc of hcs) {
    assertEquals(hc.age >= 36 && hc.age <= 68, true);
  }
});

Deno.test("coordinator ages span the coordinator tier band (~30-62)", () => {
  const result = makeGenerator().generate(INPUT);
  const coords = result.filter(
    (c) => c.role === "OC" || c.role === "DC" || c.role === "STC",
  );
  for (const coord of coords) {
    assertEquals(coord.age >= 30 && coord.age <= 62, true);
  }
});

Deno.test("position coach ages span the position tier band (~26-62)", () => {
  const result = makeGenerator().generate(INPUT);
  const positionRoles = new Set<CoachRole>([
    "QB",
    "RB",
    "WR",
    "TE",
    "OL",
    "DL",
    "LB",
    "DB",
    "ST_ASSISTANT",
  ]);
  const positions = result.filter((c) => positionRoles.has(c.role));
  for (const coach of positions) {
    assertEquals(coach.age >= 26 && coach.age <= 62, true);
  }
});

Deno.test("coach age distribution peaks near tier mode, not stacked at the midpoint", () => {
  // Regression guard against the old uniform-roll shape where every tier
  // clustered near its band midpoint. A wide band + triangular roll should
  // land each tier's mean within ~3 years of its mode across a big pool.
  const result = makeGenerator(7).generatePool({
    leagueId: "lg",
    numberOfTeams: 32,
  });
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const hcMean = avg(result.filter((c) => c.role === "HC").map((c) => c.age));
  const coordMean = avg(
    result
      .filter((c) => c.role === "OC" || c.role === "DC" || c.role === "STC")
      .map((c) => c.age),
  );
  const posMean = avg(
    result.filter((c) => c.role === "QB" || c.role === "RB" || c.role === "WR")
      .map((c) => c.age),
  );
  // Triangular expected mean = (min + mode + max) / 3.
  assertEquals(
    Math.abs(hcMean - (36 + 51 + 68) / 3) < 3,
    true,
    `HC mean=${hcMean}`,
  );
  assertEquals(
    Math.abs(coordMean - (30 + 44 + 62) / 3) < 3,
    true,
    `coord mean=${coordMean}`,
  );
  assertEquals(
    Math.abs(posMean - (26 + 40 + 62) / 3) < 3,
    true,
    `position mean=${posMean}`,
  );
});

Deno.test("coach pool includes young coaches (<40) and veterans (>55)", () => {
  // Real NFL staffs field McVay-types and Belichick-types; the tails of
  // the distribution should produce both.
  const result = makeGenerator(11).generatePool({
    leagueId: "lg",
    numberOfTeams: 32,
  });
  const young = result.filter((c) => c.age < 40).length;
  const old = result.filter((c) => c.age > 55).length;
  assertEquals(young > 0, true, "expected at least one coach under 40");
  assertEquals(old > 0, true, "expected at least one coach over 55");
});

Deno.test("ages vary within a role across the league (not a single constant)", () => {
  const result = makeGenerator().generate(INPUT);
  const hcAges = new Set(
    result.filter((c) => c.role === "HC").map((c) => c.age),
  );
  const qbAges = new Set(
    result.filter((c) => c.role === "QB").map((c) => c.age),
  );
  // With 3 HCs and 3 position QB coaches seeded, expect >1 distinct age in
  // at least one of them — the flat constant is gone.
  assertEquals(hcAges.size + qbAges.size > 2, true);
});

Deno.test("contract salaries vary within a role tier across the league", () => {
  const result = makeGenerator().generate(INPUT);
  const hcSalaries = new Set(
    result.filter((c) => c.role === "HC").map((c) => c.contractSalary),
  );
  // 3 HCs, all flat in the stub; the graduated generator must vary at least
  // one of the HCs from its peers.
  assertEquals(hcSalaries.size > 1, true);
});

Deno.test("contract years vary within a role tier across the league", () => {
  const result = makeGenerator().generate(INPUT);
  const ocYears = new Set(
    result.filter((c) => c.role === "OC").map((c) => c.contractYears),
  );
  const positionYears = new Set(
    result.filter((c) => c.role === "QB" || c.role === "RB").map((c) =>
      c.contractYears
    ),
  );
  // Across the league (3 teams) at least one tier shows variance; a flat
  // blueprint would produce a single value everywhere.
  assertEquals(ocYears.size + positionYears.size > 2, true);
});

Deno.test("hiredAt dates spread across multiple years, not all 'last year'", () => {
  const result = makeGenerator().generate(INPUT);
  const years = new Set(result.map((c) => c.hiredAt.getUTCFullYear()));
  // Graduated generator picks tenure per coach; at least two distinct hire
  // years should appear across 39 coaches.
  assertEquals(years.size > 1, true);
});

Deno.test("yearsExperience sits within tier band and never exceeds age - 22", () => {
  const result = makeGenerator().generate(INPUT);
  for (const coach of result) {
    assertEquals(coach.yearsExperience >= 0, true);
    assertEquals(coach.yearsExperience <= coach.age - 22, true);
  }
  const hcExperience = new Set(
    result.filter((c) => c.role === "HC").map((c) => c.yearsExperience),
  );
  const positionExperience = new Set(
    result.filter((c) => c.role === "QB" || c.role === "RB").map((c) =>
      c.yearsExperience
    ),
  );
  // Across 3 teams, at least one tier should show variance — the flat
  // constant is gone.
  assertEquals(hcExperience.size + positionExperience.size > 2, true);
});

Deno.test("generatePool also populates yearsExperience", () => {
  const pool = makeGenerator().generatePool({
    leagueId: "lg",
    numberOfTeams: 2,
  });
  for (const coach of pool) {
    assertEquals(coach.yearsExperience >= 0, true);
    assertEquals(coach.yearsExperience <= coach.age - 22, true);
  }
});

Deno.test("role experience sums to yearsExperience for every coach", () => {
  const result = makeGenerator().generate(INPUT);
  for (const coach of result) {
    const sum = coach.headCoachYears + coach.coordinatorYears +
      coach.positionCoachYears;
    assertEquals(
      sum,
      coach.yearsExperience,
      `coach ${coach.id} (${coach.role}) role years sum ${sum} != yearsExperience ${coach.yearsExperience}`,
    );
    assertEquals(coach.headCoachYears >= 0, true);
    assertEquals(coach.coordinatorYears >= 0, true);
    assertEquals(coach.positionCoachYears >= 0, true);
  }
});

Deno.test("position coaches have zero HC and coordinator years", () => {
  const result = makeGenerator().generate(INPUT);
  const positionRoles = new Set([
    "QB",
    "RB",
    "WR",
    "TE",
    "OL",
    "DL",
    "LB",
    "DB",
    "ST_ASSISTANT",
  ]);
  const positionCoaches = result.filter((c) => positionRoles.has(c.role));
  assertEquals(positionCoaches.length > 0, true);
  for (const coach of positionCoaches) {
    assertEquals(coach.headCoachYears, 0);
    assertEquals(coach.coordinatorYears, 0);
    assertEquals(coach.positionCoachYears, coach.yearsExperience);
  }
});

Deno.test("coordinators have zero HC years", () => {
  const result = makeGenerator().generate(INPUT);
  const coordinators = result.filter(
    (c) => c.role === "OC" || c.role === "DC" || c.role === "STC",
  );
  assertEquals(coordinators.length > 0, true);
  for (const coach of coordinators) {
    assertEquals(coach.headCoachYears, 0);
  }
});

Deno.test("HC pool contains both unproven and proven head coaches", () => {
  const pool = makeGenerator(98765).generatePool({
    leagueId: "lg",
    numberOfTeams: 8,
  });
  const hcs = pool.filter((c) => c.role === "HC");
  assertEquals(hcs.length > 0, true);
  const unproven = hcs.filter((c) => c.headCoachYears === 0);
  const proven = hcs.filter((c) => c.headCoachYears >= 3);
  assertEquals(
    unproven.length > 0,
    true,
    "expected at least one first-time HC candidate in the pool",
  );
  assertEquals(
    proven.length > 0,
    true,
    "expected at least one experienced HC candidate in the pool",
  );
});

Deno.test("generatePool also populates role experience", () => {
  const pool = makeGenerator().generatePool({
    leagueId: "lg",
    numberOfTeams: 2,
  });
  for (const coach of pool) {
    const sum = coach.headCoachYears + coach.coordinatorYears +
      coach.positionCoachYears;
    assertEquals(sum, coach.yearsExperience);
  }
});

Deno.test("contract salaries fall within sane bounds per tier", () => {
  const result = makeGenerator().generate(INPUT);
  for (const coach of result) {
    assertEquals(coach.contractSalary > 0, true);
    // HC salary ceiling is generous; position coaches floor is 250k.
    assertEquals(coach.contractSalary >= 250_000, true);
    assertEquals(coach.contractSalary <= 20_000_000, true);
    assertEquals(coach.contractBuyout >= 0, true);
  }
});

Deno.test("seeded generator is deterministic", () => {
  const fixedNow = () => new Date("2026-01-01T00:00:00Z");
  const a = createCoachesGenerator({
    random: seededRandom(42),
    nameGenerator: fixedNameGenerator(),
    now: fixedNow,
  }).generate(INPUT);
  const b = createCoachesGenerator({
    random: seededRandom(42),
    nameGenerator: fixedNameGenerator(),
    now: fixedNow,
  }).generate(INPUT);
  assertEquals(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    assertEquals(a[i].age, b[i].age);
    assertEquals(a[i].contractYears, b[i].contractYears);
    assertEquals(a[i].contractSalary, b[i].contractSalary);
    assertEquals(a[i].hiredAt.getTime(), b[i].hiredAt.getTime());
  }
});

// ---- Mentor wiring ----

Deno.test("generate wires mentorCoachId to some coaches", () => {
  const result = makeGenerator().generate(INPUT);
  const withMentor = result.filter((c) => c.mentorCoachId !== null);
  assertEquals(withMentor.length > 0, true);
});

Deno.test("generate mentorCoachId only references coaches within the same generation", () => {
  const result = makeGenerator().generate(INPUT);
  const ids = new Set(result.map((c) => c.id));
  for (const coach of result) {
    if (coach.mentorCoachId !== null) {
      assertEquals(
        ids.has(coach.mentorCoachId),
        true,
        `mentor ${coach.mentorCoachId} not in generation`,
      );
    }
  }
});

Deno.test("generate HCs have no mentorCoachId", () => {
  const result = makeGenerator().generate(INPUT);
  const hcs = result.filter((c) => c.role === "HC");
  for (const hc of hcs) {
    assertEquals(hc.mentorCoachId, null);
  }
});

// ---- Pool generation ----

const POOL_INPUT = {
  leagueId: "league-pool",
  numberOfTeams: 8,
};

function makePoolGenerator(seed = 99999) {
  return createCoachesGenerator({
    random: seededRandom(seed),
    nameGenerator: fixedNameGenerator(),
  });
}

Deno.test("generatePool creates coaches with correct leagueId", () => {
  const result = makePoolGenerator().generatePool(POOL_INPUT);
  for (const coach of result) {
    assertEquals(coach.leagueId, POOL_INPUT.leagueId);
  }
});

Deno.test("generatePool creates coaches with null teamId", () => {
  const result = makePoolGenerator().generatePool(POOL_INPUT);
  for (const coach of result) {
    assertEquals(coach.teamId, null);
  }
});

Deno.test("generatePool sizes each tier by per-team count", () => {
  const result = makePoolGenerator().generatePool(POOL_INPUT);
  const N = POOL_INPUT.numberOfTeams;
  const hcs = result.filter((c) => c.role === "HC");
  const coords = result.filter((c) =>
    c.role === "OC" || c.role === "DC" || c.role === "STC"
  );
  const positionRoles = new Set([
    "QB",
    "RB",
    "WR",
    "TE",
    "OL",
    "DL",
    "LB",
    "DB",
    "ST_ASSISTANT",
  ]);
  const positions = result.filter((c) => positionRoles.has(c.role));
  assertEquals(hcs.length, 2 * N);
  assertEquals(coords.length, 4 * N);
  assertEquals(positions.length, 6 * N);
});

Deno.test("generatePool creates coaches for all role types", () => {
  const result = makePoolGenerator().generatePool(POOL_INPUT);
  const roles = new Set(result.map((c) => c.role));
  for (const role of EXPECTED_ROLES) {
    assertEquals(roles.has(role), true, `pool missing role ${role}`);
  }
});

Deno.test("generatePool position weights favor OL/LB/DB over single-coach rooms", () => {
  const result = makePoolGenerator().generatePool(POOL_INPUT);
  const countOf = (role: string) =>
    result.filter((c) => c.role === role).length;
  for (const heavy of ["OL", "LB", "DB"]) {
    for (const light of ["QB", "RB", "WR", "TE", "DL", "ST_ASSISTANT"]) {
      assertEquals(
        countOf(heavy) > countOf(light),
        true,
        `${heavy} (${countOf(heavy)}) should exceed ${light} (${
          countOf(light)
        })`,
      );
    }
  }
});

Deno.test("generatePool assigns mentorCoachId to some coaches", () => {
  const result = makePoolGenerator().generatePool(POOL_INPUT);
  const withMentor = result.filter((c) => c.mentorCoachId !== null);
  assertEquals(withMentor.length > 0, true);
});

Deno.test("generatePool mentorCoachId only references coaches within the same pool", () => {
  const result = makePoolGenerator().generatePool(POOL_INPUT);
  const poolIds = new Set(result.map((c) => c.id));
  for (const coach of result) {
    if (coach.mentorCoachId !== null) {
      assertEquals(
        poolIds.has(coach.mentorCoachId),
        true,
        `mentor ${coach.mentorCoachId} not in pool`,
      );
    }
  }
});

Deno.test("generatePool HCs have no mentorCoachId", () => {
  const result = makePoolGenerator().generatePool(POOL_INPUT);
  const hcs = result.filter((c) => c.role === "HC");
  assertEquals(hcs.length > 0, true);
  for (const hc of hcs) {
    assertEquals(hc.mentorCoachId, null);
  }
});

Deno.test("generatePool coordinator mentors are HCs", () => {
  const result = makePoolGenerator().generatePool(POOL_INPUT);
  const hcIds = new Set(result.filter((c) => c.role === "HC").map((c) => c.id));
  const coordinatorRoles = new Set(["OC", "DC", "STC"]);
  const mentored = result.filter(
    (c) => coordinatorRoles.has(c.role) && c.mentorCoachId !== null,
  );
  for (const coord of mentored) {
    assertEquals(
      hcIds.has(coord.mentorCoachId!),
      true,
      `coordinator mentor ${coord.mentorCoachId} is not an HC`,
    );
  }
});

Deno.test("generatePool position coach mentors are coordinators", () => {
  const result = makePoolGenerator().generatePool(POOL_INPUT);
  const coordinatorRoles = new Set(["OC", "DC", "STC"]);
  const coordinatorIds = new Set(
    result.filter((c) => coordinatorRoles.has(c.role)).map((c) => c.id),
  );
  const positionRoles = new Set(
    EXPECTED_ROLES.filter((r) => !coordinatorRoles.has(r) && r !== "HC"),
  );
  const mentored = result.filter(
    (c) => positionRoles.has(c.role) && c.mentorCoachId !== null,
  );
  for (const pos of mentored) {
    assertEquals(
      coordinatorIds.has(pos.mentorCoachId!),
      true,
      `position coach mentor ${pos.mentorCoachId} is not a coordinator`,
    );
  }
});

Deno.test("generatePool all coaches have null reportsToId (pool has no org chart)", () => {
  const result = makePoolGenerator().generatePool(POOL_INPUT);
  for (const coach of result) {
    assertEquals(coach.reportsToId, null);
  }
});

Deno.test("generatePool coaches have unique ids", () => {
  const result = makePoolGenerator().generatePool(POOL_INPUT);
  const ids = new Set(result.map((c) => c.id));
  assertEquals(ids.size, result.length);
});

Deno.test("generatePool produces no coaches when numberOfTeams is 0", () => {
  const result = makePoolGenerator().generatePool({
    leagueId: "l1",
    numberOfTeams: 0,
  });
  assertEquals(result.length, 0);
});

Deno.test("generatePool sorts mentors before mentees for safe FK insertion", () => {
  const result = makePoolGenerator().generatePool(POOL_INPUT);
  const idIndex = new Map<string, number>();
  result.forEach((c, i) => idIndex.set(c.id, i));
  for (const coach of result) {
    if (coach.mentorCoachId !== null) {
      const mentorIdx = idIndex.get(coach.mentorCoachId)!;
      const coachIdx = idIndex.get(coach.id)!;
      assertEquals(
        mentorIdx < coachIdx,
        true,
        `mentor at index ${mentorIdx} should precede mentee at index ${coachIdx}`,
      );
    }
  }
});

Deno.test("generate sorts reportsTo targets before dependents for safe FK insertion", () => {
  const result = makeGenerator().generate(INPUT);
  const idIndex = new Map<string, number>();
  result.forEach((c, i) => idIndex.set(c.id, i));
  for (const coach of result) {
    if (coach.reportsToId !== null) {
      const bossIdx = idIndex.get(coach.reportsToId)!;
      const coachIdx = idIndex.get(coach.id)!;
      assertEquals(
        bossIdx < coachIdx,
        true,
        `reportsTo target at index ${bossIdx} should precede dependent at index ${coachIdx}`,
      );
    }
  }
});

Deno.test("generate sorts mentors before mentees for safe FK insertion", () => {
  const result = makeGenerator().generate(INPUT);
  const idIndex = new Map<string, number>();
  result.forEach((c, i) => idIndex.set(c.id, i));
  for (const coach of result) {
    if (coach.mentorCoachId !== null) {
      const mentorIdx = idIndex.get(coach.mentorCoachId)!;
      const coachIdx = idIndex.get(coach.id)!;
      assertEquals(
        mentorIdx < coachIdx,
        true,
        `mentor at index ${mentorIdx} should precede mentee at index ${coachIdx}`,
      );
    }
  }
});

// ---- Hidden ratings ----

Deno.test("every generated coach carries hidden ratings payload", () => {
  const result = makeGenerator().generate(INPUT);
  for (const coach of result) {
    assertNotEquals(coach.ratings, undefined);
    for (const key of COACH_RATING_KEYS) {
      const cur = coach.ratings.current[key];
      const ceil = coach.ratings.ceiling[key];
      assertEquals(Number.isInteger(cur), true);
      assertEquals(Number.isInteger(ceil), true);
      assertEquals(cur >= 1 && cur <= 99, true);
      assertEquals(ceil >= cur && ceil <= 99, true);
    }
    assertEquals(Number.isInteger(coach.ratings.growthRate), true);
    assertEquals(
      coach.ratings.growthRate >= 10 && coach.ratings.growthRate <= 95,
      true,
    );
  }
});

Deno.test("generatePool coaches carry hidden ratings payload", () => {
  const result = makePoolGenerator().generatePool(POOL_INPUT);
  for (const coach of result) {
    assertNotEquals(coach.ratings, undefined);
    for (const key of COACH_RATING_KEYS) {
      const cur = coach.ratings.current[key];
      const ceil = coach.ratings.ceiling[key];
      assertEquals(cur >= 1 && cur <= 99, true);
      assertEquals(ceil >= cur, true);
    }
  }
});

Deno.test("ratings vary across the league (not a constant roll)", () => {
  const result = makePoolGenerator().generatePool(POOL_INPUT);
  const leaderships = new Set(result.map((c) => c.ratings.current.leadership));
  const growthRates = new Set(result.map((c) => c.ratings.growthRate));
  assertEquals(leaderships.size > 1, true);
  assertEquals(growthRates.size > 1, true);
});

Deno.test("HC tier ratings bias toward leadership/gameManagement on average", () => {
  const result = makePoolGenerator().generatePool({
    leagueId: "lg",
    numberOfTeams: 32,
  });
  const hcs = result.filter((c) => c.role === "HC");
  const positions = result.filter(
    (c) =>
      c.role === "QB" || c.role === "RB" || c.role === "WR" ||
      c.role === "DL" || c.role === "LB" || c.role === "DB",
  );
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const hcLeadership = avg(hcs.map((c) => c.ratings.current.leadership));
  const positionLeadership = avg(
    positions.map((c) => c.ratings.current.leadership),
  );
  // HCs should, on average across 32 rolls, lead position coaches in
  // leadership — calibration check, not a per-coach guarantee.
  assertEquals(hcLeadership > positionLeadership, true);
});

Deno.test("ratings across the pool are bell-centered on 50 (within 2 pts)", () => {
  // Rating-scale contract: 50 is league average. A big-enough pool should
  // have a per-key mean within ~2 points of 50, with only small role
  // tilts nudging role-relevant ratings a bit higher.
  const result = makePoolGenerator().generatePool({
    leagueId: "lg",
    numberOfTeams: 32,
  });
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  for (const key of COACH_RATING_KEYS) {
    const mean = avg(result.map((c) => c.ratings.current[key]));
    const delta = Math.abs(mean - 50);
    assertEquals(
      delta < 5,
      true,
      `${key} mean=${mean.toFixed(1)} drifted >5 from 50`,
    );
  }
});

Deno.test("generatePool two leagues produce independent pools with no shared ids", () => {
  const gen = makePoolGenerator();
  const poolA = gen.generatePool({ leagueId: "league-a", numberOfTeams: 4 });
  const poolB = gen.generatePool({ leagueId: "league-b", numberOfTeams: 4 });
  const idsA = new Set(poolA.map((c) => c.id));
  for (const coach of poolB) {
    assertEquals(idsA.has(coach.id), false, `shared id ${coach.id}`);
  }
});

Deno.test("generatePool populates preference columns in 0..100 range", () => {
  const result = makePoolGenerator().generatePool(POOL_INPUT);
  for (const coach of result) {
    for (
      const key of [
        "marketTierPref",
        "philosophyFitPref",
        "staffFitPref",
        "compensationPref",
        "minimumThreshold",
      ] as const
    ) {
      const value = coach[key];
      assertNotEquals(value, null, `pool coach missing ${key}`);
      assertEquals(typeof value, "number");
      assertEquals(value! >= 0 && value! <= 100, true);
    }
  }
});

Deno.test("generatePool preference values vary across the pool", () => {
  const result = makePoolGenerator().generatePool(POOL_INPUT);
  const marketTiers = new Set(result.map((c) => c.marketTierPref));
  const compensations = new Set(result.map((c) => c.compensationPref));
  assertEquals(marketTiers.size > 1, true);
  assertEquals(compensations.size > 1, true);
});

Deno.test("generate leaves preference columns null for assigned staff", () => {
  const result = makeGenerator().generate(INPUT);
  for (const coach of result) {
    assertEquals(coach.marketTierPref, null);
    assertEquals(coach.philosophyFitPref, null);
    assertEquals(coach.staffFitPref, null);
    assertEquals(coach.compensationPref, null);
    assertEquals(coach.minimumThreshold, null);
  }
});

// ---- Contract length modal calibration (#543) ----

// Large pool so the modal-length histogram is statistically meaningful.
// 120 teams * 13 coaches = 1,560 coaches per role tier slice.
const LENGTH_POOL_INPUT = {
  leagueId: "league-length",
  numberOfTeams: 120,
};

function modeOf(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  let bestCount = -1;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

Deno.test("HC contract length has a visible mode at 5 years (#543)", () => {
  const pool = createCoachesGenerator({
    random: seededRandom(4321),
    nameGenerator: fixedNameGenerator(),
  }).generatePool(LENGTH_POOL_INPUT);
  const hcYears = pool.filter((c) => c.role === "HC").map((c) =>
    c.contractYears
  );
  assertEquals(hcYears.length > 100, true);
  assertEquals(modeOf(hcYears), 5);
  const fiveCount = hcYears.filter((y) => y === 5).length;
  const share = fiveCount / hcYears.length;
  // Weighted spec is 0.55 at 5 years; allow generous slack around that prior.
  assertEquals(
    share >= 0.45 && share <= 0.65,
    true,
    `expected 5yr share in [0.45,0.65], got ${share.toFixed(3)}`,
  );
  // Contract bounds: 3..6 inclusive (new weighted spec extends past old 5-cap).
  for (const y of hcYears) {
    assertEquals(y >= 3 && y <= 6, true, `unexpected HC contract years ${y}`);
  }
});

Deno.test("Coordinator contract length is modal at 3 years (#543)", () => {
  const pool = createCoachesGenerator({
    random: seededRandom(4322),
    nameGenerator: fixedNameGenerator(),
  }).generatePool(LENGTH_POOL_INPUT);
  const coordYears = pool
    .filter((c) => c.role === "OC" || c.role === "DC" || c.role === "STC")
    .map((c) => c.contractYears);
  assertEquals(coordYears.length > 100, true);
  assertEquals(modeOf(coordYears), 3);
});

Deno.test("Position coach contract length is modal at 2 years (#543)", () => {
  const pool = createCoachesGenerator({
    random: seededRandom(4323),
    nameGenerator: fixedNameGenerator(),
  }).generatePool(LENGTH_POOL_INPUT);
  const positionRoles = new Set([
    "QB",
    "RB",
    "WR",
    "TE",
    "OL",
    "DL",
    "LB",
    "DB",
    "ST_ASSISTANT",
  ]);
  const years = pool
    .filter((c) => positionRoles.has(c.role))
    .map((c) => c.contractYears);
  assertEquals(years.length > 100, true);
  assertEquals(modeOf(years), 2);
});

// ---- First-time HC age gating (#543) ----

Deno.test(
  "first-time HC rate is age-gated: young >> middle >> senior (#543)",
  () => {
    // Use generatePool (which rolls HCs) across many teams to get decent
    // sample counts in each age band.
    const pool = createCoachesGenerator({
      random: seededRandom(7777),
      nameGenerator: fixedNameGenerator(),
    }).generatePool({ leagueId: "lg-age", numberOfTeams: 200 });
    const hcs = pool.filter((c) => c.role === "HC");
    const young = hcs.filter((c) => c.age < 45);
    const middle = hcs.filter((c) => c.age >= 45 && c.age < 55);
    const senior = hcs.filter((c) => c.age >= 55);
    // With ageMode 51 and range 36–68, all three buckets should be populated.
    assertEquals(young.length > 20, true, `young sample ${young.length}`);
    assertEquals(middle.length > 20, true, `middle sample ${middle.length}`);
    assertEquals(senior.length > 20, true, `senior sample ${senior.length}`);

    const rate = (arr: typeof hcs) =>
      arr.filter((c) => c.headCoachYears === 0).length / arr.length;
    const youngRate = rate(young);
    const middleRate = rate(middle);
    const seniorRate = rate(senior);

    // Spec: <45 = 0.50, 45–54 = 0.20, 55+ = 0.05.
    assertEquals(
      youngRate >= 0.35 && youngRate <= 0.65,
      true,
      `young first-time rate ${youngRate.toFixed(3)} outside [0.35,0.65]`,
    );
    assertEquals(
      middleRate >= 0.10 && middleRate <= 0.32,
      true,
      `middle first-time rate ${middleRate.toFixed(3)} outside [0.10,0.32]`,
    );
    assertEquals(
      seniorRate <= 0.15,
      true,
      `senior first-time rate ${seniorRate.toFixed(3)} above 0.15`,
    );
    // Ordering must hold: young strictly > middle > senior.
    assertEquals(
      youngRate > middleRate,
      true,
      `young ${youngRate} !> middle ${middleRate}`,
    );
    assertEquals(
      middleRate > seniorRate,
      true,
      `middle ${middleRate} !> senior ${seniorRate}`,
    );
  },
);
