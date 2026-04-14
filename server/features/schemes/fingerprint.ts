import type { CoachTendencies, SchemeFingerprint } from "@zone-blitz/shared";

/**
 * Staff slice required to compute a team's scheme fingerprint.
 * Each slot is the coordinator's tendency row — `null` when vacant
 * or not yet populated. Per ADR 0007, v1 reads only OC and DC; HC
 * overrides and STC tendencies land in a follow-up.
 */
export interface StaffTendencies {
  oc?: CoachTendencies | null;
  dc?: CoachTendencies | null;
}

/**
 * Pure function: compose the per-coordinator tendency vectors into a
 * team-level fingerprint. The fingerprint is never persisted — this
 * runs on read, so swapping a coordinator immediately shifts what the
 * UI and sim see (per ADR 0007's compute-on-read stance).
 */
export function computeFingerprint(staff: StaffTendencies): SchemeFingerprint {
  return {
    offense: staff.oc?.offense ?? null,
    defense: staff.dc?.defense ?? null,
    overrides: {},
  };
}
