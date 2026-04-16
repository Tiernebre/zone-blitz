import type { CoachRole, ScoutRole } from "@zone-blitz/shared";
import type { SalaryBand } from "./preference-scoring.ts";

// Salary bands mirrored here so callers (service, NPC AI, future modules) can
// consume them from one place. The bands match the figures used elsewhere in
// the hiring pipeline.
export const COACH_SALARY_BANDS: Record<CoachRole, SalaryBand> = {
  HC: { min: 5_000_000, max: 20_000_000 },
  OC: { min: 1_500_000, max: 6_000_000 },
  DC: { min: 1_500_000, max: 5_000_000 },
  STC: { min: 800_000, max: 2_000_000 },
  QB: { min: 500_000, max: 1_500_000 },
  RB: { min: 300_000, max: 1_200_000 },
  WR: { min: 300_000, max: 1_200_000 },
  TE: { min: 300_000, max: 1_200_000 },
  OL: { min: 300_000, max: 1_200_000 },
  DL: { min: 300_000, max: 1_200_000 },
  LB: { min: 300_000, max: 1_200_000 },
  DB: { min: 300_000, max: 1_200_000 },
  ST_ASSISTANT: { min: 250_000, max: 600_000 },
};

export const SCOUT_SALARY_BANDS: Record<ScoutRole, SalaryBand> = {
  DIRECTOR: { min: 250_000, max: 800_000 },
  NATIONAL_CROSS_CHECKER: { min: 150_000, max: 400_000 },
  AREA_SCOUT: { min: 80_000, max: 200_000 },
};

// Roles the HC's staff covers, in priority order: coordinators first, then
// position coaches.
export const COACH_STAFF_ROLES: readonly CoachRole[] = [
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
] as const;

// Scouting org under the Director: a national cross-checker plus three area
// scouts. v1 hard-codes the 3 area scouts.
export const SCOUT_STAFF_ROLES: readonly ScoutRole[] = [
  "NATIONAL_CROSS_CHECKER",
  "AREA_SCOUT",
  "AREA_SCOUT",
  "AREA_SCOUT",
] as const;

const DEFAULT_QUALITY = 200;
const CONTRACT_YEARS = 2;
const BUYOUT_FACTOR = 0.5;

export interface StaffPoolMember {
  id: string;
  role: string;
  // Quality proxy = sum of preference attributes (0..400). Defaults to mid
  // (200) when any preference is missing.
  quality: number;
}

export interface CoachAssignment {
  staffId: string;
  role: CoachRole;
  salary: number;
  contractYears: number;
  contractBuyout: number;
}

export interface ScoutAssignment {
  staffId: string;
  role: ScoutRole;
  salary: number;
  contractYears: number;
  contractBuyout: number;
}

export interface AssembleCoachingStaffInput {
  hcQuality: number;
  pool: StaffPoolMember[];
  remainingBudget: number;
  rng: () => number;
}

export interface AssembleCoachingStaffResult {
  assignments: CoachAssignment[];
  spent: number;
}

export interface AssembleScoutingStaffInput {
  dosQuality: number;
  pool: StaffPoolMember[];
  remainingBudget: number;
  rng: () => number;
}

export interface AssembleScoutingStaffResult {
  assignments: ScoutAssignment[];
  spent: number;
}

export function poolMemberQuality(prefs: {
  marketTierPref: number | null;
  philosophyFitPref: number | null;
  staffFitPref: number | null;
  compensationPref: number | null;
}): number {
  if (
    prefs.marketTierPref === null ||
    prefs.philosophyFitPref === null ||
    prefs.staffFitPref === null ||
    prefs.compensationPref === null
  ) {
    return DEFAULT_QUALITY;
  }
  return prefs.marketTierPref + prefs.philosophyFitPref + prefs.staffFitPref +
    prefs.compensationPref;
}

function salaryFor(band: SalaryBand, quality: number): number {
  const normalized = Math.max(0, Math.min(1, quality / 400));
  return Math.round(band.min + (band.max - band.min) * normalized);
}

function buyoutFor(salary: number): number {
  return Math.round(salary * CONTRACT_YEARS * BUYOUT_FACTOR);
}

function pickBest<T extends StaffPoolMember>(
  candidates: T[],
  leaderQuality: number,
  rng: () => number,
): T | undefined {
  if (candidates.length === 0) return undefined;
  const bias = (leaderQuality - DEFAULT_QUALITY) * 0.5;
  let best: T | undefined;
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const score = candidate.quality + bias + rng() * 10;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

interface AssemblyContext {
  pool: StaffPoolMember[];
  picked: Set<string>;
  remainingBudget: number;
  leaderQuality: number;
  rng: () => number;
}

interface PickedAssignment {
  staffId: string;
  quality: number;
  salary: number;
  contractBuyout: number;
}

function tryPickForRole(
  ctx: AssemblyContext,
  role: string,
  band: SalaryBand,
): PickedAssignment | undefined {
  const candidates = ctx.pool.filter(
    (m) => m.role === role && !ctx.picked.has(m.id),
  );
  const picked = pickBest(candidates, ctx.leaderQuality, ctx.rng);
  if (!picked) return undefined;
  let salary = salaryFor(band, picked.quality);
  if (salary > ctx.remainingBudget) {
    if (band.min > ctx.remainingBudget) return undefined;
    salary = band.min;
  }
  ctx.picked.add(picked.id);
  ctx.remainingBudget -= salary;
  return {
    staffId: picked.id,
    quality: picked.quality,
    salary,
    contractBuyout: buyoutFor(salary),
  };
}

export function assembleCoachingStaff(
  input: AssembleCoachingStaffInput,
): AssembleCoachingStaffResult {
  const ctx: AssemblyContext = {
    pool: input.pool,
    picked: new Set(),
    remainingBudget: input.remainingBudget,
    leaderQuality: input.hcQuality,
    rng: input.rng,
  };
  const assignments: CoachAssignment[] = [];
  let spent = 0;
  for (const role of COACH_STAFF_ROLES) {
    const pick = tryPickForRole(ctx, role, COACH_SALARY_BANDS[role]);
    if (!pick) continue;
    assignments.push({
      staffId: pick.staffId,
      role,
      salary: pick.salary,
      contractYears: CONTRACT_YEARS,
      contractBuyout: pick.contractBuyout,
    });
    spent += pick.salary;
  }
  return { assignments, spent };
}

export function assembleScoutingStaff(
  input: AssembleScoutingStaffInput,
): AssembleScoutingStaffResult {
  const ctx: AssemblyContext = {
    pool: input.pool,
    picked: new Set(),
    remainingBudget: input.remainingBudget,
    leaderQuality: input.dosQuality,
    rng: input.rng,
  };
  const assignments: ScoutAssignment[] = [];
  let spent = 0;
  for (const role of SCOUT_STAFF_ROLES) {
    const pick = tryPickForRole(ctx, role, SCOUT_SALARY_BANDS[role]);
    if (!pick) continue;
    assignments.push({
      staffId: pick.staffId,
      role,
      salary: pick.salary,
      contractYears: CONTRACT_YEARS,
      contractBuyout: pick.contractBuyout,
    });
    spent += pick.salary;
  }
  return { assignments, spent };
}
