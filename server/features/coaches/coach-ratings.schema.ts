import { integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { coaches } from "./coach.schema.ts";

/**
 * Hidden coach ratings (1:1 with `coaches`). Every coach carries a row
 * — GMs never see these numbers, but the sim and the interview layer
 * read them. Values are 0–100. `ceiling*` caps future growth; young
 * coaches start with a wide current/ceiling gap, veterans sit near
 * theirs. `growthRate` modulates how fast the gap closes each season.
 *
 * This table MUST NOT be joined into any public coach aggregate.
 */
export const coachRatings = pgTable("coach_ratings", {
  coachId: uuid("coach_id")
    .primaryKey()
    .references(() => coaches.id, { onDelete: "cascade" }),
  leadership: integer("leadership").notNull(),
  leadershipCeiling: integer("leadership_ceiling").notNull(),
  gameManagement: integer("game_management").notNull(),
  gameManagementCeiling: integer("game_management_ceiling").notNull(),
  schemeMastery: integer("scheme_mastery").notNull(),
  schemeMasteryCeiling: integer("scheme_mastery_ceiling").notNull(),
  playerDevelopment: integer("player_development").notNull(),
  playerDevelopmentCeiling: integer("player_development_ceiling").notNull(),
  adaptability: integer("adaptability").notNull(),
  adaptabilityCeiling: integer("adaptability_ceiling").notNull(),
  growthRate: integer("growth_rate").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
