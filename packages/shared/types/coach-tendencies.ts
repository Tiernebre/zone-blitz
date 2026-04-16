/**
 * Coaching scheme tendencies live on coordinators. Each axis is a 0–100
 * integer position on a named spectrum. Values are only numeric for
 * storage/compute; the UI renders bar positions, never the integer itself.
 *
 * Offensive tendencies belong to the OC (or the offense-side HC when he
 * holds the OC slot); defensive tendencies belong to the DC. Both sides
 * are nullable on a single row because a given coordinator populates
 * only the side that matches his specialty.
 */

export interface OffensiveTendencies {
  runPassLean: number;
  tempo: number;
  personnelWeight: number;
  formationUnderCenterShotgun: number;
  preSnapMotionRate: number;
  passingStyle: number;
  passingDepth: number;
  runGameBlocking: number;
  rpoIntegration: number;
}

export interface DefensiveTendencies {
  frontOddEven: number;
  gapResponsibility: number;
  subPackageLean: number;
  coverageManZone: number;
  coverageShell: number;
  cornerPressOff: number;
  pressureRate: number;
  disguiseRate: number;
}

export const OFFENSIVE_TENDENCY_KEYS: readonly (keyof OffensiveTendencies)[] = [
  "runPassLean",
  "tempo",
  "personnelWeight",
  "formationUnderCenterShotgun",
  "preSnapMotionRate",
  "passingStyle",
  "passingDepth",
  "runGameBlocking",
  "rpoIntegration",
] as const;

export const DEFENSIVE_TENDENCY_KEYS: readonly (keyof DefensiveTendencies)[] = [
  "frontOddEven",
  "gapResponsibility",
  "subPackageLean",
  "coverageManZone",
  "coverageShell",
  "cornerPressOff",
  "pressureRate",
  "disguiseRate",
] as const;

export interface CoachTendencies {
  coachId: string;
  offense: OffensiveTendencies | null;
  defense: DefensiveTendencies | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CoachTendenciesUpsertInput =
  & { coachId: string }
  & Partial<OffensiveTendencies>
  & Partial<DefensiveTendencies>;
