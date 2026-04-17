import { eq } from "drizzle-orm";
import type pino from "pino";
import type {
  CoachRatings,
  CoachRatingsUpsertInput,
  CoachRatingValues,
} from "@zone-blitz/shared";
import type { Database, Executor } from "../../db/connection.ts";
import { coachRatings } from "./coach-ratings.schema.ts";

type CoachRatingsRow = typeof coachRatings.$inferSelect;

function toCoachRatings(row: CoachRatingsRow): CoachRatings {
  const current: CoachRatingValues = {
    leadership: row.leadership,
    gameManagement: row.gameManagement,
    schemeMastery: row.schemeMastery,
    playerDevelopment: row.playerDevelopment,
    adaptability: row.adaptability,
  };
  const ceiling: CoachRatingValues = {
    leadership: row.leadershipCeiling,
    gameManagement: row.gameManagementCeiling,
    schemeMastery: row.schemeMasteryCeiling,
    playerDevelopment: row.playerDevelopmentCeiling,
    adaptability: row.adaptabilityCeiling,
  };
  return {
    coachId: row.coachId,
    current,
    ceiling,
    growthRate: row.growthRate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface CoachRatingsRepository {
  /**
   * Returns the hidden ratings for a coach, or `undefined` when no row
   * exists. Callers must NOT expose these numbers through any public
   * aggregate — they drive sim outcomes and feed the interview layer.
   */
  getByCoachId(coachId: string): Promise<CoachRatings | undefined>;

  /**
   * Inserts or replaces the full ratings row for a coach. Pass an
   * optional `exec` to route the write through an in-progress
   * transaction so the referenced coach row is visible for the FK check.
   */
  upsert(
    input: CoachRatingsUpsertInput,
    exec?: Executor,
  ): Promise<CoachRatings>;
}

export function createCoachRatingsRepository(deps: {
  db: Database;
  log: pino.Logger;
}): CoachRatingsRepository {
  const log = deps.log.child({ module: "coach-ratings.repository" });

  return {
    async getByCoachId(coachId) {
      log.debug({ coachId }, "fetching coach ratings");
      const [row] = await deps.db
        .select()
        .from(coachRatings)
        .where(eq(coachRatings.coachId, coachId))
        .limit(1);
      return row ? toCoachRatings(row) : undefined;
    },

    async upsert(input, exec) {
      log.debug({ coachId: input.coachId }, "upserting coach ratings");
      const values = {
        coachId: input.coachId,
        leadership: input.current.leadership,
        leadershipCeiling: input.ceiling.leadership,
        gameManagement: input.current.gameManagement,
        gameManagementCeiling: input.ceiling.gameManagement,
        schemeMastery: input.current.schemeMastery,
        schemeMasteryCeiling: input.ceiling.schemeMastery,
        playerDevelopment: input.current.playerDevelopment,
        playerDevelopmentCeiling: input.ceiling.playerDevelopment,
        adaptability: input.current.adaptability,
        adaptabilityCeiling: input.ceiling.adaptability,
        growthRate: input.growthRate,
        updatedAt: new Date(),
      };

      const executor = exec ?? deps.db;
      const { coachId: _coachId, ...setValues } = values;
      const [row] = await executor
        .insert(coachRatings)
        .values(values)
        .onConflictDoUpdate({
          target: coachRatings.coachId,
          set: setValues,
        })
        .returning();
      return toCoachRatings(row);
    },
  };
}
