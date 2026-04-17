import { eq } from "drizzle-orm";
import type pino from "pino";
import type {
  ScoutRatings,
  ScoutRatingsUpsertInput,
  ScoutRatingValues,
} from "@zone-blitz/shared";
import type { Database, Executor } from "../../db/connection.ts";
import { scoutRatings } from "./scout-ratings.schema.ts";

type ScoutRatingsRow = typeof scoutRatings.$inferSelect;

function toScoutRatings(row: ScoutRatingsRow): ScoutRatings {
  const current: ScoutRatingValues = {
    accuracy: row.accuracy,
    projection: row.projection,
    intangibleRead: row.intangibleRead,
    confidenceCalibration: row.confidenceCalibration,
    biasResistance: row.biasResistance,
  };
  const ceiling: ScoutRatingValues = {
    accuracy: row.accuracyCeiling,
    projection: row.projectionCeiling,
    intangibleRead: row.intangibleReadCeiling,
    confidenceCalibration: row.confidenceCalibrationCeiling,
    biasResistance: row.biasResistanceCeiling,
  };
  return {
    scoutId: row.scoutId,
    current,
    ceiling,
    growthRate: row.growthRate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface ScoutRatingsRepository {
  /**
   * Returns the hidden ratings for a scout, or `undefined` when no row
   * exists. Callers must NOT expose these numbers through any public
   * aggregate — they drive the noise and bias the scouting layer
   * applies to evaluation outputs.
   */
  getByScoutId(scoutId: string): Promise<ScoutRatings | undefined>;

  /**
   * Inserts or replaces the full ratings row for a scout. Pass an
   * optional `exec` to route the write through an in-progress
   * transaction so the referenced scout row is visible for the FK
   * check.
   */
  upsert(
    input: ScoutRatingsUpsertInput,
    exec?: Executor,
  ): Promise<ScoutRatings>;
}

export function createScoutRatingsRepository(deps: {
  db: Database;
  log: pino.Logger;
}): ScoutRatingsRepository {
  const log = deps.log.child({ module: "scout-ratings.repository" });

  return {
    async getByScoutId(scoutId) {
      log.debug({ scoutId }, "fetching scout ratings");
      const [row] = await deps.db
        .select()
        .from(scoutRatings)
        .where(eq(scoutRatings.scoutId, scoutId))
        .limit(1);
      return row ? toScoutRatings(row) : undefined;
    },

    async upsert(input, exec) {
      log.debug({ scoutId: input.scoutId }, "upserting scout ratings");
      const values = {
        scoutId: input.scoutId,
        accuracy: input.current.accuracy,
        accuracyCeiling: input.ceiling.accuracy,
        projection: input.current.projection,
        projectionCeiling: input.ceiling.projection,
        intangibleRead: input.current.intangibleRead,
        intangibleReadCeiling: input.ceiling.intangibleRead,
        confidenceCalibration: input.current.confidenceCalibration,
        confidenceCalibrationCeiling: input.ceiling.confidenceCalibration,
        biasResistance: input.current.biasResistance,
        biasResistanceCeiling: input.ceiling.biasResistance,
        growthRate: input.growthRate,
        updatedAt: new Date(),
      };

      const executor = exec ?? deps.db;
      const { scoutId: _scoutId, ...setValues } = values;
      const [row] = await executor
        .insert(scoutRatings)
        .values(values)
        .onConflictDoUpdate({
          target: scoutRatings.scoutId,
          set: setValues,
        })
        .returning();
      return toScoutRatings(row);
    },
  };
}
