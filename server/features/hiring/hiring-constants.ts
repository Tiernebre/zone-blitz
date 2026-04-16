import type { CoachRole, ScoutRole } from "@zone-blitz/shared";
import type { SalaryBand } from "./preference-scoring.ts";
import type { StaffType } from "./hiring.repository.ts";

// Candidate preference fields are 0–100 scores. When a DB row has no
// value (NPC candidates that never had preferences seeded), treat it as
// neutral rather than biasing toward either extreme.
export const PREFERENCE_NEUTRAL = 50;

// Interviews are modeled as the team probing the candidate with a
// midpoint offer to see whether the candidate would consider signing.
// Two years is the shortest contract the game exposes.
export const INTERVIEW_PROBE_YEARS = 2;
export const PROBE_OFFER_ID_PREFIX = "probe-";

// finalize() and resolveBlocker() auto-assign unsigned mandatory roles
// at the salary-band midpoint with a short contract and a standard
// half-year-salary buyout. These constants are the defaults for those
// auto-assigns only — negotiated contracts use the offer's own values.
export const FINALIZE_CONTRACT_YEARS = 2;
export const FINALIZE_BUYOUT_MULTIPLIER = 0.5;

// Waves 1 and 2 are the primary and second-wave decision steps. 99
// marks the terminal finalization step so consumers can distinguish
// auto-fills from contested decisions.
export const FINALIZE_WAVE = 99;

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

export const COORDINATOR_PARENTS: Partial<Record<CoachRole, CoachRole>> = {
  OC: "HC",
  DC: "HC",
  STC: "HC",
  QB: "OC",
  RB: "OC",
  WR: "OC",
  TE: "OC",
  OL: "OC",
  DL: "DC",
  LB: "DC",
  DB: "DC",
  ST_ASSISTANT: "STC",
};

export const MANDATORY_COACH_ROLES: CoachRole[] = ["HC"];
export const MANDATORY_SCOUT_ROLES: ScoutRole[] = ["DIRECTOR"];

export function bandFor(
  staffType: StaffType,
  role: CoachRole | ScoutRole,
): SalaryBand {
  if (staffType === "coach") {
    return COACH_SALARY_BANDS[role as CoachRole];
  }
  return SCOUT_SALARY_BANDS[role as ScoutRole];
}

export function salaryMidpoint(band: SalaryBand): number {
  return Math.round((band.min + band.max) / 2);
}

export function midpointBuyout(salary: number, contractYears: number): number {
  return Math.round(salary * contractYears * FINALIZE_BUYOUT_MULTIPLIER);
}
