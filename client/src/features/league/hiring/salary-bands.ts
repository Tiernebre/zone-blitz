import type { HiringCandidateSummary } from "@zone-blitz/shared";

export interface SalaryBand {
  min: number;
  max: number;
}

export const COACH_SALARY_BANDS: Record<string, SalaryBand> = {
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

export const SCOUT_SALARY_BANDS: Record<string, SalaryBand> = {
  DIRECTOR: { min: 250_000, max: 800_000 },
  NATIONAL_CROSS_CHECKER: { min: 150_000, max: 400_000 },
  AREA_SCOUT: { min: 80_000, max: 200_000 },
};

export function bandFor(
  staffType: "coach" | "scout",
  role: string,
): SalaryBand {
  if (staffType === "coach") {
    return COACH_SALARY_BANDS[role] ?? { min: 100_000, max: 1_000_000 };
  }
  return SCOUT_SALARY_BANDS[role] ?? { min: 50_000, max: 300_000 };
}

export function medianSalary(
  staffType: "coach" | "scout",
  role: string,
): number {
  const band = bandFor(staffType, role);
  return Math.round((band.min + band.max) / 2);
}

const COORDINATOR_ROLES = new Set(["OC", "DC", "STC"]);

/**
 * How many years a coach has spent in the *same role* they're now being
 * hired for. This is what separates a first-time HC from a proven one:
 * both may have 20 years of coaching, but one has 0 years actually
 * running a team. For scouts we fall back to overall years since the
 * scout ladder is flatter.
 */
export function roleTenureYears(
  candidate: HiringCandidateSummary,
): number {
  if (candidate.staffType === "scout") return candidate.yearsExperience ?? 0;
  if (candidate.role === "HC") return candidate.headCoachYears ?? 0;
  if (COORDINATOR_ROLES.has(candidate.role)) {
    return candidate.coordinatorYears ?? 0;
  }
  return candidate.positionCoachYears ?? 0;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Compute the salary a coach or scout is expected to ask for, given only
 * publicly visible facts (tenure in their target role, age, overall
 * career length). Position within the role's market band is driven
 * dominantly by role-specific tenure — a first-time head coach sits near
 * the floor of the HC band, a long-tenured HC sits near the top, even
 * though both advertise the same role.
 */
export function expectedSalaryForCandidate(
  candidate: HiringCandidateSummary,
): number {
  const band = bandFor(candidate.staffType, candidate.role);
  const tenure = roleTenureYears(candidate);
  const tenureScore = clamp01(tenure / 10);
  const ageScore = clamp01(((candidate.age ?? 0) - 35) / 20);
  const overallScore = clamp01((candidate.yearsExperience ?? 0) / 25);
  const position = clamp01(
    0.2 + tenureScore * 0.6 + ageScore * 0.1 + overallScore * 0.1,
  );
  const raw = band.min + position * (band.max - band.min);
  return Math.round(raw / 100_000) * 100_000;
}

export function formatMoney(amount: number): string {
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `$${millions.toFixed(millions >= 10 ? 0 : 1)}M`;
  }
  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}K`;
  }
  return `$${amount}`;
}
