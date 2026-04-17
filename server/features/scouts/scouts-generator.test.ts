import { assertEquals, assertNotEquals } from "@std/assert";
import { SCOUT_RATING_KEYS } from "@zone-blitz/shared";
import {
  createScoutsGenerator,
  type NameGenerator,
  SCOUTS_PER_TEAM,
} from "./scouts-generator.ts";

const TEAM_IDS = ["team-1", "team-2", "team-3"];
const INPUT = {
  leagueId: "league-1",
  teamIds: TEAM_IDS,
};

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
  return createScoutsGenerator({
    random: seededRandom(seed),
    nameGenerator: fixedNameGenerator(),
  });
}

Deno.test("generates the full staff blueprint for each team", () => {
  const result = makeGenerator().generate(INPUT);

  assertEquals(result.length, TEAM_IDS.length * SCOUTS_PER_TEAM);
  for (const teamId of TEAM_IDS) {
    const teamScouts = result.filter((s) => s.teamId === teamId);
    assertEquals(teamScouts.length, SCOUTS_PER_TEAM);

    const director = teamScouts.find((s) => s.role === "DIRECTOR");
    assertEquals(director?.reportsToId, null);

    const crossCheckers = teamScouts.filter(
      (s) => s.role === "NATIONAL_CROSS_CHECKER",
    );
    assertEquals(crossCheckers.length, 2);
    for (const cc of crossCheckers) {
      assertEquals(cc.reportsToId, director?.id);
    }

    const areaScouts = teamScouts.filter((s) => s.role === "AREA_SCOUT");
    assertEquals(areaScouts.length, 4);
    for (const scout of areaScouts) {
      const reportsTo = teamScouts.find((s) => s.id === scout.reportsToId);
      assertEquals(reportsTo?.role, "NATIONAL_CROSS_CHECKER");
    }
  }
});

Deno.test("all scouts have the correct leagueId, names, and work capacity", () => {
  const result = makeGenerator().generate(INPUT);

  for (const scout of result) {
    assertEquals(scout.leagueId, INPUT.leagueId);
    assertEquals(scout.firstName.length > 0, true);
    assertEquals(scout.lastName.length > 0, true);
    assertEquals(scout.workCapacity > 0, true);
    assertEquals(scout.isVacancy, false);
  }
});

Deno.test("generates no scouts when no teams provided", () => {
  const result = makeGenerator().generate({ leagueId: "l1", teamIds: [] });
  assertEquals(result.length, 0);
});

// ---- Graduated-behaviour assertions ----

Deno.test("director ages span the director tier band (~40-70)", () => {
  const result = makeGenerator().generate(INPUT);
  const directors = result.filter((s) => s.role === "DIRECTOR");
  for (const d of directors) {
    assertEquals(d.age >= 40 && d.age <= 70, true);
  }
});

Deno.test("national cross-checker ages span the cross-checker tier band (~32-64)", () => {
  const result = makeGenerator().generate(INPUT);
  const ccs = result.filter((s) => s.role === "NATIONAL_CROSS_CHECKER");
  for (const cc of ccs) {
    assertEquals(cc.age >= 32 && cc.age <= 64, true);
  }
});

Deno.test("area scout ages span the area scout tier band (~25-58)", () => {
  const result = makeGenerator().generate(INPUT);
  const areas = result.filter((s) => s.role === "AREA_SCOUT");
  for (const a of areas) {
    assertEquals(a.age >= 25 && a.age <= 58, true);
  }
});

Deno.test("scout age distribution peaks near tier mode, not stacked at the midpoint", () => {
  // Regression guard against the old narrow uniform roll where directors
  // all landed near 58 and area scouts near 40. A wide triangular roll
  // should produce tier means within ~3 years of their intended modes.
  const result = makeGenerator(7).generatePool({
    leagueId: "lg",
    numberOfTeams: 32,
  });
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const dirMean = avg(
    result.filter((s) => s.role === "DIRECTOR").map((s) => s.age),
  );
  const ccMean = avg(
    result.filter((s) => s.role === "NATIONAL_CROSS_CHECKER").map((s) => s.age),
  );
  const areaMean = avg(
    result.filter((s) => s.role === "AREA_SCOUT").map((s) => s.age),
  );
  // Triangular expected mean = (min + mode + max) / 3.
  assertEquals(
    Math.abs(dirMean - (40 + 54 + 70) / 3) < 3,
    true,
    `director mean=${dirMean}`,
  );
  assertEquals(
    Math.abs(ccMean - (32 + 46 + 64) / 3) < 3,
    true,
    `cc mean=${ccMean}`,
  );
  assertEquals(
    Math.abs(areaMean - (25 + 36 + 58) / 3) < 3,
    true,
    `area scout mean=${areaMean}`,
  );
});

Deno.test("scout pool includes young scouts (<32) and veterans (>55)", () => {
  const result = makeGenerator(11).generatePool({
    leagueId: "lg",
    numberOfTeams: 32,
  });
  const young = result.filter((s) => s.age < 32).length;
  const old = result.filter((s) => s.age > 55).length;
  assertEquals(young > 0, true, "expected at least one scout under 32");
  assertEquals(old > 0, true, "expected at least one scout over 55");
});

Deno.test("contract years vary within a role tier across the league", () => {
  const result = makeGenerator().generate(INPUT);
  const dirYears = new Set(
    result.filter((s) => s.role === "DIRECTOR").map((s) => s.contractYears),
  );
  const ccYears = new Set(
    result.filter((s) => s.role === "NATIONAL_CROSS_CHECKER").map((s) =>
      s.contractYears
    ),
  );
  assertEquals(dirYears.size + ccYears.size > 2, true);
});

Deno.test("contract salaries vary within a role tier across the league", () => {
  const result = makeGenerator().generate(INPUT);
  const areaSalaries = new Set(
    result.filter((s) => s.role === "AREA_SCOUT").map((s) => s.contractSalary),
  );
  // 12 area scouts across 3 teams; the flat blueprint emitted a single
  // salary, so >1 distinct value proves the variance pass shipped.
  assertEquals(areaSalaries.size > 1, true);
});

Deno.test("work capacities vary within a role tier across the league", () => {
  const result = makeGenerator().generate(INPUT);
  const areaCapacities = new Set(
    result.filter((s) => s.role === "AREA_SCOUT").map((s) => s.workCapacity),
  );
  // The stub emitted a single capacity per role; graduated must vary.
  assertEquals(areaCapacities.size > 1, true);
  for (const s of result) {
    if (s.role === "AREA_SCOUT") {
      assertEquals(s.workCapacity >= 80 && s.workCapacity <= 160, true);
    }
    if (s.role === "NATIONAL_CROSS_CHECKER") {
      assertEquals(s.workCapacity >= 140 && s.workCapacity <= 220, true);
    }
    if (s.role === "DIRECTOR") {
      assertEquals(s.workCapacity >= 160 && s.workCapacity <= 240, true);
    }
  }
});

Deno.test("hiredAt dates spread across multiple years", () => {
  const result = makeGenerator().generate(INPUT);
  const years = new Set(result.map((s) => s.hiredAt.getUTCFullYear()));
  assertEquals(years.size > 1, true);
});

Deno.test("contract salaries fall within per-role bounds", () => {
  const result = makeGenerator().generate(INPUT);
  for (const s of result) {
    assertEquals(s.contractSalary > 0, true);
    assertEquals(s.contractBuyout >= 0, true);
    if (s.role === "DIRECTOR") {
      assertEquals(s.contractSalary >= 250_000, true);
      assertEquals(s.contractSalary <= 800_000, true);
    }
    if (s.role === "NATIONAL_CROSS_CHECKER") {
      assertEquals(s.contractSalary >= 150_000, true);
      assertEquals(s.contractSalary <= 400_000, true);
    }
    if (s.role === "AREA_SCOUT") {
      assertEquals(s.contractSalary >= 80_000, true);
      assertEquals(s.contractSalary <= 200_000, true);
    }
  }
});

Deno.test("contract years fall within per-role bounds", () => {
  const result = makeGenerator().generate(INPUT);
  for (const s of result) {
    if (s.role === "DIRECTOR") {
      assertEquals(s.contractYears >= 3 && s.contractYears <= 5, true);
    }
    if (s.role === "NATIONAL_CROSS_CHECKER") {
      assertEquals(s.contractYears >= 2 && s.contractYears <= 4, true);
    }
    if (s.role === "AREA_SCOUT") {
      assertEquals(s.contractYears >= 1 && s.contractYears <= 3, true);
    }
  }
});

Deno.test("yearsExperience sits within tier band and never exceeds age - 22", () => {
  const result = makeGenerator().generate(INPUT);
  for (const s of result) {
    assertEquals(s.yearsExperience >= 0, true);
    assertEquals(s.yearsExperience <= s.age - 22, true);
  }
  // At least one role should show variance across the league.
  const directorExp = new Set(
    result.filter((s) => s.role === "DIRECTOR").map((s) => s.yearsExperience),
  );
  const areaExp = new Set(
    result.filter((s) => s.role === "AREA_SCOUT").map((s) => s.yearsExperience),
  );
  assertEquals(directorExp.size + areaExp.size > 2, true);
});

Deno.test("generatePool also populates yearsExperience", () => {
  const pool = makeGenerator().generatePool({
    leagueId: "lg",
    numberOfTeams: 2,
  });
  for (const s of pool) {
    assertEquals(s.yearsExperience >= 0, true);
    assertEquals(s.yearsExperience <= s.age - 22, true);
  }
});

Deno.test("seeded generator is deterministic", () => {
  const fixedNow = () => new Date("2026-01-01T00:00:00Z");
  const a = createScoutsGenerator({
    random: seededRandom(42),
    nameGenerator: fixedNameGenerator(),
    now: fixedNow,
  }).generate(INPUT);
  const b = createScoutsGenerator({
    random: seededRandom(42),
    nameGenerator: fixedNameGenerator(),
    now: fixedNow,
  }).generate(INPUT);
  assertEquals(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    assertEquals(a[i].age, b[i].age);
    assertEquals(a[i].contractYears, b[i].contractYears);
    assertEquals(a[i].contractSalary, b[i].contractSalary);
    assertEquals(a[i].workCapacity, b[i].workCapacity);
    assertEquals(a[i].hiredAt.getTime(), b[i].hiredAt.getTime());
  }
});

// ---- generatePool assertions ----

Deno.test("generatePool creates unassigned scouts with no teamId", () => {
  const result = makeGenerator().generatePool({
    leagueId: "league-1",
    numberOfTeams: 3,
  });

  for (const scout of result) {
    assertEquals(scout.teamId, null);
    assertEquals(scout.leagueId, "league-1");
  }
});

Deno.test("generatePool sizes each tier by per-team count with NFL 1:3 CC-to-area split", () => {
  const N = 4;
  const result = makeGenerator().generatePool({
    leagueId: "league-1",
    numberOfTeams: N,
  });

  const directors = result.filter((s) => s.role === "DIRECTOR");
  const crossCheckers = result.filter(
    (s) => s.role === "NATIONAL_CROSS_CHECKER",
  );
  const areaScouts = result.filter((s) => s.role === "AREA_SCOUT");

  assertEquals(directors.length, 2 * N);
  assertEquals(crossCheckers.length + areaScouts.length, 4 * N);
  // 1:3 cross-checker to area-scout ratio mirrors real NFL clubs.
  assertEquals(crossCheckers.length, N);
  assertEquals(areaScouts.length, 3 * N);
});

Deno.test("generatePool returns empty array when numberOfTeams is 0", () => {
  const result = makeGenerator().generatePool({
    leagueId: "league-1",
    numberOfTeams: 0,
  });
  assertEquals(result.length, 0);
});

Deno.test("generatePool scouts have no reportsToId (flat pool)", () => {
  const result = makeGenerator().generatePool({
    leagueId: "league-1",
    numberOfTeams: 2,
  });

  for (const scout of result) {
    assertEquals(scout.reportsToId, null);
  }
});

Deno.test("generatePool scouts have valid attributes within role bands", () => {
  const result = makeGenerator().generatePool({
    leagueId: "league-1",
    numberOfTeams: 3,
  });

  for (const scout of result) {
    assertEquals(scout.isVacancy, false);
    assertEquals(scout.firstName.length > 0, true);
    assertEquals(scout.lastName.length > 0, true);
    assertEquals(scout.workCapacity > 0, true);
    assertEquals(scout.contractSalary > 0, true);
  }
});

Deno.test("generatePool populates preference columns in 0..100 range", () => {
  const result = makeGenerator().generatePool({
    leagueId: "league-1",
    numberOfTeams: 4,
  });
  for (const scout of result) {
    for (
      const key of [
        "marketTierPref",
        "philosophyFitPref",
        "staffFitPref",
        "compensationPref",
        "minimumThreshold",
      ] as const
    ) {
      const value = scout[key];
      assertNotEquals(value, null, `pool scout missing ${key}`);
      assertEquals(typeof value, "number");
      assertEquals(value! >= 0 && value! <= 100, true);
    }
  }
});

Deno.test("generatePool preference values vary across the pool", () => {
  const result = makeGenerator().generatePool({
    leagueId: "league-1",
    numberOfTeams: 6,
  });
  const marketTiers = new Set(result.map((s) => s.marketTierPref));
  const compensations = new Set(result.map((s) => s.compensationPref));
  assertEquals(marketTiers.size > 1, true);
  assertEquals(compensations.size > 1, true);
});

Deno.test("generate leaves preference columns null for assigned scouts", () => {
  const result = makeGenerator().generate(INPUT);
  for (const scout of result) {
    assertEquals(scout.marketTierPref, null);
    assertEquals(scout.philosophyFitPref, null);
    assertEquals(scout.staffFitPref, null);
    assertEquals(scout.compensationPref, null);
    assertEquals(scout.minimumThreshold, null);
  }
});

// ---- Hidden ratings (Geno Smith Line distribution) ----
//
// Scout hidden ratings follow the same 0-100 scale contract coach
// ratings do (see `docs/product/north-star/player-attributes.md` —
// 50 is the Mendoza line, elite is 85+, generational 95+). The
// generator rolls a bell-shaped distribution around a mean of 50 with
// small per-role tilts so league-wide means stay at 50 and elite
// evaluators emerge from the upper tail.

Deno.test("every generated scout carries a full ratings bundle in 1..99", () => {
  const result = makeGenerator().generate(INPUT);
  for (const scout of result) {
    const { current, ceiling, growthRate } = scout.ratings;
    for (const key of SCOUT_RATING_KEYS) {
      assertEquals(typeof current[key], "number");
      assertEquals(current[key] >= 1 && current[key] <= 99, true);
      assertEquals(ceiling[key] >= current[key], true);
      assertEquals(ceiling[key] <= 99, true);
    }
    assertEquals(growthRate >= 10 && growthRate <= 95, true);
  }
});

Deno.test("rating current values average near the 50 midpoint across a pool", () => {
  const result = makeGenerator(3).generatePool({
    leagueId: "lg",
    numberOfTeams: 32,
  });
  const values: number[] = [];
  for (const scout of result) {
    for (const key of SCOUT_RATING_KEYS) {
      values.push(scout.ratings.current[key]);
    }
  }
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  // Role tilts shift the mean a few points above 50; guard a band wide
  // enough to avoid flaking on seed noise but narrow enough to catch
  // a regression that re-anchors to 60 or 40.
  assertEquals(
    mean >= 47 && mean <= 56,
    true,
    `expected pool rating mean in [47, 56]; got ${mean.toFixed(1)}`,
  );
});

Deno.test("elite (85+) scout ratings are rare — well under 5% of rolls", () => {
  const result = makeGenerator(5).generatePool({
    leagueId: "lg",
    numberOfTeams: 32,
  });
  let total = 0;
  let elite = 0;
  for (const scout of result) {
    for (const key of SCOUT_RATING_KEYS) {
      total++;
      if (scout.ratings.current[key] >= 85) elite++;
    }
  }
  assertEquals(
    elite / total < 0.05,
    true,
    `expected <5% elite ratings; got ${elite}/${total}`,
  );
});

Deno.test("young scouts carry a wider ceiling gap than veterans", () => {
  const result = makeGenerator(9).generatePool({
    leagueId: "lg",
    numberOfTeams: 32,
  });
  const areaScouts = result.filter((s) => s.role === "AREA_SCOUT");
  const young = areaScouts.filter((s) => s.age <= 30);
  const veteran = areaScouts.filter((s) => s.age >= 50);
  assertEquals(young.length > 0, true, "expected some young area scouts");
  assertEquals(veteran.length > 0, true, "expected some veteran area scouts");

  const avgGap = (scouts: typeof areaScouts) => {
    let sum = 0;
    let count = 0;
    for (const s of scouts) {
      for (const key of SCOUT_RATING_KEYS) {
        sum += s.ratings.ceiling[key] - s.ratings.current[key];
        count++;
      }
    }
    return sum / count;
  };

  assertEquals(
    avgGap(young) > avgGap(veteran),
    true,
    `young gap=${avgGap(young).toFixed(1)} should exceed veteran gap=${
      avgGap(veteran).toFixed(1)
    }`,
  );
});

Deno.test("role tilts favor accuracy for directors", () => {
  const result = makeGenerator(13).generatePool({
    leagueId: "lg",
    numberOfTeams: 32,
  });
  const directors = result.filter((s) => s.role === "DIRECTOR");
  const areaScouts = result.filter((s) => s.role === "AREA_SCOUT");
  const avgAccuracy = (scouts: typeof directors) =>
    scouts.reduce((s, sc) => s + sc.ratings.current.accuracy, 0) /
    scouts.length;
  assertEquals(
    avgAccuracy(directors) > avgAccuracy(areaScouts),
    true,
    `director accuracy mean=${avgAccuracy(directors).toFixed(1)} vs area=${
      avgAccuracy(areaScouts).toFixed(1)
    }`,
  );
});

Deno.test("generatePool rolls directors across the full position-focus pool", () => {
  const result = makeGenerator(7777).generatePool({
    leagueId: "league-1",
    numberOfTeams: 40,
  });
  const directors = result.filter((s) => s.role === "DIRECTOR");
  const focusCounts = new Map<string, number>();
  for (const d of directors) {
    const focus = d.positionFocus ?? "GENERALIST";
    focusCounts.set(focus, (focusCounts.get(focus) ?? 0) + 1);
  }

  assertEquals(
    focusCounts.size >= 6,
    true,
    `expected ≥6 distinct director position focuses, got ${focusCounts.size}`,
  );

  const generalists = focusCounts.get("GENERALIST") ?? 0;
  assertEquals(
    generalists < directors.length * 0.5,
    true,
    `expected <50% generalist directors, got ${generalists}/${directors.length}`,
  );
});

// ---- Hidden personality traits ----
//
// Scouts carry personality traits parallel to the coach model, minus
// scheme attachment (scouts evaluate players, not schemes) and plus
// two scout-specific traits: `conviction` and `travelTolerance`.
// Rolled on the 0–100 scale centered at 50 with a bell-shaped
// distribution, stable per scout, hidden from the UI.

const SCOUT_PERSONALITY_KEYS = [
  "loyalty",
  "greed",
  "ambition",
  "conviction",
  "travelTolerance",
] as const;

Deno.test("every generated scout carries a full personality payload", () => {
  const result = makeGenerator().generate(INPUT);
  for (const scout of result) {
    assertNotEquals(scout.personality, undefined);
    for (const key of SCOUT_PERSONALITY_KEYS) {
      const value = scout.personality[key];
      assertEquals(
        Number.isInteger(value),
        true,
        `scout ${scout.id} ${key} not integer: ${value}`,
      );
      assertEquals(
        value >= 0 && value <= 100,
        true,
        `scout ${scout.id} ${key}=${value} outside 0..100`,
      );
    }
  }
});

Deno.test("generatePool scouts carry personality payload", () => {
  const result = makeGenerator(777).generatePool({
    leagueId: "lg",
    numberOfTeams: 8,
  });
  for (const scout of result) {
    assertNotEquals(scout.personality, undefined);
    for (const key of SCOUT_PERSONALITY_KEYS) {
      const value = scout.personality[key];
      assertEquals(value >= 0 && value <= 100, true);
    }
  }
});

Deno.test("scout personality is stable for a given seed", () => {
  const a = makeGenerator(55).generate(INPUT);
  const b = makeGenerator(55).generate(INPUT);
  assertEquals(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    for (const key of SCOUT_PERSONALITY_KEYS) {
      assertEquals(a[i].personality[key], b[i].personality[key]);
    }
  }
});

Deno.test("scout personality values vary across a pool", () => {
  const result = makeGenerator(99).generatePool({
    leagueId: "lg",
    numberOfTeams: 32,
  });
  for (const key of SCOUT_PERSONALITY_KEYS) {
    const distinct = new Set(result.map((s) => s.personality[key]));
    assertEquals(
      distinct.size > 1,
      true,
      `expected variance on ${key}, got constant roll`,
    );
  }
});

Deno.test("scout personality is bell-centered on 50 across a large pool", () => {
  const result = makeGenerator(111).generatePool({
    leagueId: "lg",
    numberOfTeams: 32,
  });
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  for (const key of SCOUT_PERSONALITY_KEYS) {
    const values = result.map((s) => s.personality[key]);
    const mean = avg(values);
    assertEquals(
      mean >= 45 && mean <= 60,
      true,
      `${key} mean=${mean.toFixed(1)} drifted outside [45, 60]`,
    );
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) /
      values.length;
    const sd = Math.sqrt(variance);
    assertEquals(
      sd >= 8 && sd <= 22,
      true,
      `${key} sd=${sd.toFixed(1)} outside expected bell band`,
    );
  }
});

Deno.test("area scouts carry higher travel tolerance on average than directors", () => {
  const result = makeGenerator(4242).generatePool({
    leagueId: "lg",
    numberOfTeams: 32,
  });
  const areaScouts = result.filter((s) => s.role === "AREA_SCOUT");
  const directors = result.filter((s) => s.role === "DIRECTOR");
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const areaTravel = avg(areaScouts.map((s) => s.personality.travelTolerance));
  const directorTravel = avg(
    directors.map((s) => s.personality.travelTolerance),
  );
  assertEquals(
    areaTravel > directorTravel,
    true,
    `area-scout travel tolerance=${
      areaTravel.toFixed(1)
    } should exceed director travel tolerance=${directorTravel.toFixed(1)}`,
  );
});
