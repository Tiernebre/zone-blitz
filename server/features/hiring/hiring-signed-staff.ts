import type { CoachRole, ScoutRole } from "@zone-blitz/shared";
import type { SignedStaffMember } from "./hiring.repository.ts";
import {
  MANDATORY_COACH_ROLES,
  MANDATORY_SCOUT_ROLES,
} from "./hiring-constants.ts";

export interface SignedCoachRef {
  staffId: string;
  role: CoachRole;
}

export function signedCoachRoles(signed: SignedStaffMember[]): Set<CoachRole> {
  return new Set(
    signed
      .filter((m) => m.staffType === "coach")
      .map((m) => m.role as CoachRole),
  );
}

export function signedScoutRoles(signed: SignedStaffMember[]): Set<ScoutRole> {
  return new Set(
    signed
      .filter((m) => m.staffType === "scout")
      .map((m) => m.role as ScoutRole),
  );
}

export function signedCoachRefs(signed: SignedStaffMember[]): SignedCoachRef[] {
  return signed
    .filter((m) => m.staffType === "coach")
    .map((m) => ({ staffId: m.staffId, role: m.role as CoachRole }));
}

export function missingMandatoryCoachRoles(
  signed: SignedStaffMember[],
): CoachRole[] {
  const have = signedCoachRoles(signed);
  return MANDATORY_COACH_ROLES.filter((r) => !have.has(r));
}

export function missingMandatoryScoutRoles(
  signed: SignedStaffMember[],
): ScoutRole[] {
  const have = signedScoutRoles(signed);
  return MANDATORY_SCOUT_ROLES.filter((r) => !have.has(r));
}
