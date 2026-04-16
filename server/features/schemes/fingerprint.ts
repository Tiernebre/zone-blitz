import type { CoachTendencies, SchemeFingerprint } from "@zone-blitz/shared";

/**
 * Staff slice required to compute a team's scheme fingerprint.
 * Each slot is the coordinator's tendency row — `null` when vacant
 * or not yet populated. V1 reads only OC and DC; HC overrides and
 * STC tendencies land in a follow-up.
 */
export interface StaffTendencies {
  oc?: CoachTendencies | null;
  dc?: CoachTendencies | null;
}

/**
 * Pure function: compose the per-coordinator tendency vectors into a
 * team-level fingerprint. The fingerprint is never persisted — this
 * runs on read, so swapping a coordinator immediately shifts what the
 * UI and sim see.
 */
export function computeFingerprint(staff: StaffTendencies): SchemeFingerprint {
  return {
    offense: staff.oc?.offense ?? null,
    defense: staff.dc?.defense ?? null,
    overrides: {},
  };
}
