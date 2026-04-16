import { assertEquals } from "@std/assert";
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

Deno.test("director ages span the director tier band (~50-65)", () => {
  const result = makeGenerator().generate(INPUT);
  const directors = result.filter((s) => s.role === "DIRECTOR");
  for (const d of directors) {
    assertEquals(d.age >= 50 && d.age <= 65, true);
  }
});

Deno.test("national cross-checker ages span the cross-checker tier band (~42-58)", () => {
  const result = makeGenerator().generate(INPUT);
  const ccs = result.filter((s) => s.role === "NATIONAL_CROSS_CHECKER");
  for (const cc of ccs) {
    assertEquals(cc.age >= 42 && cc.age <= 58, true);
  }
});

Deno.test("area scout ages span the area scout tier band (~30-50)", () => {
  const result = makeGenerator().generate(INPUT);
  const areas = result.filter((s) => s.role === "AREA_SCOUT");
  for (const a of areas) {
    assertEquals(a.age >= 30 && a.age <= 50, true);
  }
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

Deno.test("contract salaries fall within ADR 0032 per-role bounds", () => {
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

Deno.test("contract years fall within ADR 0032 per-role bounds", () => {
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

Deno.test("generatePool creates 1.5x scouts per role per team count", () => {
  const result = makeGenerator().generatePool({
    leagueId: "league-1",
    numberOfTeams: 4,
  });

  const countPerRole = Math.ceil(4 * 1.5);
  const directors = result.filter((s) => s.role === "DIRECTOR");
  const crossCheckers = result.filter(
    (s) => s.role === "NATIONAL_CROSS_CHECKER",
  );
  const areaScouts = result.filter((s) => s.role === "AREA_SCOUT");

  assertEquals(directors.length, countPerRole);
  assertEquals(crossCheckers.length, countPerRole * 2); // 2 cross-checker slots
  assertEquals(areaScouts.length, countPerRole * 4); // 4 area scout slots
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
