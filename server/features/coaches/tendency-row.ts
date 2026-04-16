import type {
  CoachTendencies,
  DefensiveTendencies,
  OffensiveTendencies,
} from "@zone-blitz/shared";
import {
  DEFENSIVE_TENDENCY_KEYS,
  OFFENSIVE_TENDENCY_KEYS,
} from "@zone-blitz/shared";
import type { coachTendencies } from "./coach-tendencies.schema.ts";

export type CoachTendencyRow = typeof coachTendencies.$inferSelect;

// A fully-null offense/defense block is how the schema represents
// "coach has not set their tendencies yet" — return null so callers
// can distinguish that from "set, but every value is zero".
export function pickOffense(row: CoachTendencyRow): OffensiveTendencies | null {
  if (OFFENSIVE_TENDENCY_KEYS.every((k) => row[k] === null)) return null;
  const out = {} as OffensiveTendencies;
  for (const k of OFFENSIVE_TENDENCY_KEYS) out[k] = (row[k] ?? 0) as number;
  return out;
}

export function pickDefense(row: CoachTendencyRow): DefensiveTendencies | null {
  if (DEFENSIVE_TENDENCY_KEYS.every((k) => row[k] === null)) return null;
  const out = {} as DefensiveTendencies;
  for (const k of DEFENSIVE_TENDENCY_KEYS) out[k] = (row[k] ?? 0) as number;
  return out;
}

export function toCoachTendencies(row: CoachTendencyRow): CoachTendencies {
  return {
    coachId: row.coachId,
    offense: pickOffense(row),
    defense: pickDefense(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
