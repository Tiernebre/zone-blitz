import { eq } from "drizzle-orm";
import type pino from "pino";
import {
  DEFENSIVE_TENDENCY_KEYS,
  OFFENSIVE_TENDENCY_KEYS,
} from "@zone-blitz/shared";
import type { Database } from "../../db/connection.ts";
import { coachTendencies } from "./coach-tendencies.schema.ts";
import { toCoachTendencies } from "./tendency-row.ts";
import type { CoachTendenciesRepository } from "./coach-tendencies.repository.interface.ts";

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

    async upsert(input, exec) {
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

      const executor = exec ?? deps.db;
      const [row] = await executor
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
