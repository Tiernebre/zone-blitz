import { assertEquals } from "@std/assert";
import { mulberry32 } from "@zone-blitz/shared";
import {
  assembleCoachingStaff,
  assembleScoutingStaff,
  COACH_SALARY_BANDS,
  COACH_STAFF_ROLES,
  poolMemberQuality,
  SCOUT_SALARY_BANDS,
  SCOUT_STAFF_ROLES,
  type StaffPoolMember,
} from "./staff-assembly.ts";

function member(
  role: string,
  quality: number,
  id?: string,
): StaffPoolMember {
  return {
    id: id ?? `${role}-${quality}-${crypto.randomUUID()}`,
    role,
    quality,
  };
}

function fullCoachPool(
  qualityForRole: (role: string) => number,
): StaffPoolMember[] {
  return COACH_STAFF_ROLES.map((role) => member(role, qualityForRole(role)));
}

function fullScoutPool(): StaffPoolMember[] {
  // Need NCC + 3 area scouts available.
  return [
    member("NATIONAL_CROSS_CHECKER", 200),
    member("AREA_SCOUT", 200),
    member("AREA_SCOUT", 200),
    member("AREA_SCOUT", 200),
  ];
}

const HUGE = Number.MAX_SAFE_INTEGER;

Deno.test("poolMemberQuality: returns sum of preferences when all present", () => {
  const q = poolMemberQuality({
    marketTierPref: 50,
    philosophyFitPref: 60,
    staffFitPref: 70,
    compensationPref: 80,
  });
  assertEquals(q, 260);
});

Deno.test("poolMemberQuality: returns mid (200) when any preference is null", () => {
  const q = poolMemberQuality({
    marketTierPref: 50,
    philosophyFitPref: null,
    staffFitPref: 70,
    compensationPref: 80,
  });
  assertEquals(q, 200);
});

Deno.test("assembleCoachingStaff: fills all 12 staff slots when pool is plentiful", () => {
  const pool = fullCoachPool(() => 200);
  const result = assembleCoachingStaff({
    hcQuality: 200,
    pool,
    remainingBudget: HUGE,
    rng: mulberry32(1),
  });
  assertEquals(result.assignments.length, COACH_STAFF_ROLES.length);
  assertEquals(
    result.assignments.map((a) => a.role).sort(),
    [...COACH_STAFF_ROLES].sort(),
  );
});

Deno.test("assembleCoachingStaff: contract years and buyout match salary band", () => {
  const pool = fullCoachPool(() => 200);
  const result = assembleCoachingStaff({
    hcQuality: 200,
    pool,
    remainingBudget: HUGE,
    rng: mulberry32(1),
  });
  for (const a of result.assignments) {
    assertEquals(a.contractYears, 2);
    assertEquals(a.contractBuyout, Math.round(a.salary * 2 * 0.5));
  }
});

Deno.test("assembleCoachingStaff: skips a role with no candidate in pool", () => {
  // Pool excludes OC.
  const pool = COACH_STAFF_ROLES
    .filter((r) => r !== "OC")
    .map((r) => member(r, 200));
  const result = assembleCoachingStaff({
    hcQuality: 200,
    pool,
    remainingBudget: HUGE,
    rng: mulberry32(1),
  });
  const roles = result.assignments.map((a) => a.role);
  assertEquals(roles.includes("OC"), false);
  assertEquals(result.assignments.length, COACH_STAFF_ROLES.length - 1);
});

Deno.test("assembleCoachingStaff: empty pool returns no assignments and zero spent", () => {
  const result = assembleCoachingStaff({
    hcQuality: 200,
    pool: [],
    remainingBudget: HUGE,
    rng: mulberry32(1),
  });
  assertEquals(result.assignments, []);
  assertEquals(result.spent, 0);
});

Deno.test("assembleCoachingStaff: deterministic given the same seed and pool", () => {
  const pool = fullCoachPool(() => 200);
  const a = assembleCoachingStaff({
    hcQuality: 200,
    pool,
    remainingBudget: HUGE,
    rng: mulberry32(42),
  });
  const b = assembleCoachingStaff({
    hcQuality: 200,
    pool,
    remainingBudget: HUGE,
    rng: mulberry32(42),
  });
  assertEquals(
    a.assignments.map((x) => x.staffId),
    b.assignments.map((x) => x.staffId),
  );
});

Deno.test("assembleCoachingStaff: high-HC quality biases pick toward higher-quality candidate", () => {
  // Two OC candidates: one strong (350) and one weak (50). Other roles are
  // empty so OC is the only picked role.
  const strong = member("OC", 350, "oc-strong");
  const weak = member("OC", 50, "oc-weak");
  const pool: StaffPoolMember[] = [strong, weak];

  // With low-quality HC the bias drags scores down equally; rng dominates a
  // bit, but the pure quality gap (300) overwhelms a (low - 200) * 0.5 = -100
  // shift. Both runs should pick the strong candidate, but importantly the
  // computed score for strong with high-HC bias must exceed the score with
  // low-HC bias.
  const highResult = assembleCoachingStaff({
    hcQuality: 400,
    pool,
    remainingBudget: HUGE,
    rng: mulberry32(7),
  });
  const lowResult = assembleCoachingStaff({
    hcQuality: 0,
    pool,
    remainingBudget: HUGE,
    rng: mulberry32(7),
  });
  // High quality leader should consistently pick the strong candidate.
  assertEquals(highResult.assignments[0].staffId, "oc-strong");
  // Salary lerp scales with picked.quality, so strong (350) costs more than
  // weak (50) would. Confirm the high-HC pick spent at the strong candidate's
  // band fraction.
  const strongSalary = Math.round(
    COACH_SALARY_BANDS.OC.min +
      (COACH_SALARY_BANDS.OC.max - COACH_SALARY_BANDS.OC.min) * (350 / 400),
  );
  assertEquals(highResult.assignments[0].salary, strongSalary);
  // Low-HC run is allowed to differ but with this seed will still pick the
  // strong candidate (gap is huge); we assert that the salary is determined
  // by the picked candidate's quality, not by the leader's quality.
  assertEquals(
    lowResult.assignments[0].salary,
    Math.round(
      COACH_SALARY_BANDS.OC.min +
        (COACH_SALARY_BANDS.OC.max - COACH_SALARY_BANDS.OC.min) *
          (lowResult.assignments[0].staffId === "oc-strong"
            ? 350 / 400
            : 50 / 400),
    ),
  );
});

Deno.test("assembleCoachingStaff: degrades to band.min when computed salary exceeds remaining budget", () => {
  // Single OC in pool with high quality so lerped salary is near max.
  const pool = [member("OC", 400, "oc-only")];
  // Budget is just above OC.min but below the high-quality lerp.
  const remainingBudget = COACH_SALARY_BANDS.OC.min + 100;
  const result = assembleCoachingStaff({
    hcQuality: 200,
    pool,
    remainingBudget,
    rng: mulberry32(1),
  });
  assertEquals(result.assignments.length, 1);
  assertEquals(result.assignments[0].salary, COACH_SALARY_BANDS.OC.min);
});

Deno.test("assembleCoachingStaff: skips a role entirely when even band.min is unaffordable", () => {
  const pool = [member("OC", 400, "oc-only")];
  const result = assembleCoachingStaff({
    hcQuality: 200,
    pool,
    remainingBudget: COACH_SALARY_BANDS.OC.min - 1,
    rng: mulberry32(1),
  });
  assertEquals(result.assignments, []);
  assertEquals(result.spent, 0);
});

Deno.test("assembleCoachingStaff: tracks total spent across all roles", () => {
  const pool = fullCoachPool(() => 200);
  const result = assembleCoachingStaff({
    hcQuality: 200,
    pool,
    remainingBudget: HUGE,
    rng: mulberry32(1),
  });
  const sum = result.assignments.reduce((acc, a) => acc + a.salary, 0);
  assertEquals(result.spent, sum);
});

Deno.test("assembleScoutingStaff: fills 1 NCC + 3 area scouts when pool is plentiful", () => {
  const pool = fullScoutPool();
  const result = assembleScoutingStaff({
    dosQuality: 200,
    pool,
    remainingBudget: HUGE,
    rng: mulberry32(1),
  });
  assertEquals(result.assignments.length, SCOUT_STAFF_ROLES.length);
  const roles = result.assignments.map((a) => a.role).sort();
  assertEquals(
    roles,
    ["AREA_SCOUT", "AREA_SCOUT", "AREA_SCOUT", "NATIONAL_CROSS_CHECKER"],
  );
});

Deno.test("assembleScoutingStaff: deterministic given the same seed and pool", () => {
  const pool = fullScoutPool();
  const a = assembleScoutingStaff({
    dosQuality: 200,
    pool,
    remainingBudget: HUGE,
    rng: mulberry32(11),
  });
  const b = assembleScoutingStaff({
    dosQuality: 200,
    pool,
    remainingBudget: HUGE,
    rng: mulberry32(11),
  });
  assertEquals(
    a.assignments.map((x) => x.staffId),
    b.assignments.map((x) => x.staffId),
  );
});

Deno.test("assembleScoutingStaff: skips a role when pool has no candidate of that role", () => {
  // Only 2 area scouts; NCC missing.
  const pool: StaffPoolMember[] = [
    member("AREA_SCOUT", 200),
    member("AREA_SCOUT", 200),
  ];
  const result = assembleScoutingStaff({
    dosQuality: 200,
    pool,
    remainingBudget: HUGE,
    rng: mulberry32(1),
  });
  // 2 area scouts placed, 1 NCC + 1 area scout missing.
  assertEquals(result.assignments.length, 2);
  assertEquals(
    result.assignments.every((a) => a.role === "AREA_SCOUT"),
    true,
  );
});

Deno.test("assembleScoutingStaff: empty pool returns no assignments and zero spent", () => {
  const result = assembleScoutingStaff({
    dosQuality: 200,
    pool: [],
    remainingBudget: HUGE,
    rng: mulberry32(1),
  });
  assertEquals(result.assignments, []);
  assertEquals(result.spent, 0);
});

Deno.test("assembleScoutingStaff: respects budget — drops roles when band.min unaffordable", () => {
  const pool = fullScoutPool();
  // Only enough budget for one NCC at min.
  const result = assembleScoutingStaff({
    dosQuality: 200,
    pool,
    remainingBudget: SCOUT_SALARY_BANDS.NATIONAL_CROSS_CHECKER.min,
    rng: mulberry32(1),
  });
  assertEquals(result.assignments.length, 1);
  assertEquals(
    result.assignments[0].role,
    "NATIONAL_CROSS_CHECKER",
  );
  assertEquals(
    result.assignments[0].salary,
    SCOUT_SALARY_BANDS.NATIONAL_CROSS_CHECKER.min,
  );
});

Deno.test("assembleScoutingStaff: contract terms applied per assignment", () => {
  const pool = fullScoutPool();
  const result = assembleScoutingStaff({
    dosQuality: 200,
    pool,
    remainingBudget: HUGE,
    rng: mulberry32(1),
  });
  for (const a of result.assignments) {
    assertEquals(a.contractYears, 2);
    assertEquals(a.contractBuyout, Math.round(a.salary * 2 * 0.5));
  }
});
