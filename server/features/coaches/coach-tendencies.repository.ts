import { eq } from "drizzle-orm";
import type pino from "pino";
import type {
  CoachTendencies,
  DefensiveTendencies,
  OffensiveTendencies,
} from "@zone-blitz/shared";
import {
  DEFENSIVE_TENDENCY_KEYS,
  OFFENSIVE_TENDENCY_KEYS,
} from "@zone-blitz/shared";
import type { Database } from "../../db/connection.ts";
import { coachTendencies } from "./coach-tendencies.schema.ts";
import type { CoachTendenciesRepository } from "./coach-tendencies.repository.interface.ts";

type CoachTendencyRow = typeof coachTendencies.$inferSelect;

function pickOffense(row: CoachTendencyRow): OffensiveTendencies | null {
  const values = OFFENSIVE_TENDENCY_KEYS.map((key) => row[key]);
  if (values.every((v) => v === null)) return null;
  const out = {} as OffensiveTendencies;
  for (const key of OFFENSIVE_TENDENCY_KEYS) {
    out[key] = (row[key] ?? 0) as number;
  }
  return out;
}

function pickDefense(row: CoachTendencyRow): DefensiveTendencies | null {
  const values = DEFENSIVE_TENDENCY_KEYS.map((key) => row[key]);
  if (values.every((v) => v === null)) return null;
  const out = {} as DefensiveTendencies;
  for (const key of DEFENSIVE_TENDENCY_KEYS) {
    out[key] = (row[key] ?? 0) as number;
  }
  return out;
}

function toCoachTendencies(row: CoachTendencyRow): CoachTendencies {
  return {
    coachId: row.coachId,
    offense: pickOffense(row),
    defense: pickDefense(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createCoachTendenciesRepository(deps: {
  db: Database;
  log: pino.Logger;
}): CoachTendenciesRepository {
  const log = deps.log.child({ module: "coach-tendencies.repository" });

  return {
    async getByCoachId(coachId) {
      log.debug({ coachId }, "fetching coach tendencies");
      const [row] = await deps.db
        .select()
        .from(coachTendencies)
        .where(eq(coachTendencies.coachId, coachId))
        .limit(1);
      return row ? toCoachTendencies(row) : undefined;
    },

    async upsert(input) {
      log.debug({ coachId: input.coachId }, "upserting coach tendencies");
      const { coachId, ...rest } = input;
      const updateSet: Record<string, number> = {};
      for (
        const key of [
          ...OFFENSIVE_TENDENCY_KEYS,
          ...DEFENSIVE_TENDENCY_KEYS,
        ]
      ) {
        const value = (rest as Record<string, number | undefined>)[key];
        if (value !== undefined) {
          updateSet[key] = value;
        }
      }

      const [row] = await deps.db
        .insert(coachTendencies)
        .values({ coachId, ...updateSet, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: coachTendencies.coachId,
          set: { ...updateSet, updatedAt: new Date() },
        })
        .returning();
      return toCoachTendencies(row);
    },
  };
}
