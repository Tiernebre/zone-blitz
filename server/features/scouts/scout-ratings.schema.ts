import { integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { scouts } from "./scout.schema.ts";

/**
 * Hidden scout ratings (1:1 with `scouts`). Every scout carries a row
 * — GMs never see these numbers, but the scouting layer reads them
 * when applying noise and bias to evaluation outputs. Values are
 * 0–100. `*Ceiling` caps future growth; young scouts start with a wide
 * current/ceiling gap, veterans sit near theirs. `growthRate`
 * modulates how fast the gap closes each offseason.
 *
 * This table MUST NOT be joined into any public scout aggregate.
 */
export const scoutRatings = pgTable("scout_ratings", {
  scoutId: uuid("scout_id")
    .primaryKey()
    .references(() => scouts.id, { onDelete: "cascade" }),
  accuracy: integer("accuracy").notNull(),
  accuracyCeiling: integer("accuracy_ceiling").notNull(),
  projection: integer("projection").notNull(),
  projectionCeiling: integer("projection_ceiling").notNull(),
  intangibleRead: integer("intangible_read").notNull(),
  intangibleReadCeiling: integer("intangible_read_ceiling").notNull(),
  confidenceCalibration: integer("confidence_calibration").notNull(),
  confidenceCalibrationCeiling: integer("confidence_calibration_ceiling")
    .notNull(),
  biasResistance: integer("bias_resistance").notNull(),
  biasResistanceCeiling: integer("bias_resistance_ceiling").notNull(),
  growthRate: integer("growth_rate").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
