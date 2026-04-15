import { integer, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { leagues } from "../league/league.schema.ts";

export const seasonPhaseEnum = pgEnum("season_phase", [
  "preseason",
  "regular_season",
  "playoffs",
  "offseason",
]);

export const offseasonStageEnum = pgEnum("offseason_stage", [
  "awards_and_review",
  "coaching_carousel",
  "combine",
  "free_agency",
  "draft",
  "udfa_signing",
  "minicamp",
]);

export const seasons = pgTable("seasons", {
  id: uuid("id").defaultRandom().primaryKey(),
  leagueId: uuid("league_id")
    .notNull()
    .references(() => leagues.id, { onDelete: "cascade" }),
  year: integer("year").notNull().default(1),
  phase: seasonPhaseEnum("phase").notNull().default("preseason"),
  offseasonStage: offseasonStageEnum("offseason_stage"),
  week: integer("week").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
