import type {
  DefensiveTendencies,
  OffensiveTendencies,
} from "./coach-tendencies.ts";

/**
 * HC situational overrides (aggressiveness, 4th-down lean, etc.) per
 * ADR 0007. Reserved for a follow-up slice — v1 ships an empty
 * record so the Fingerprint shape stays stable when overrides are
 * introduced.
 */
export type SchemeFingerprintOverrides = Record<string, number>;

/**
 * The computed team-level scheme fingerprint. Per ADR 0007 this is
 * never persisted — it is derived on read from the currently-hired
 * coordinators. Either side can be `null` when the relevant
 * coordinator slot is vacant or not yet populated with tendencies.
 */
export interface SchemeFingerprint {
  offense: OffensiveTendencies | null;
  defense: DefensiveTendencies | null;
  overrides: SchemeFingerprintOverrides;
}
