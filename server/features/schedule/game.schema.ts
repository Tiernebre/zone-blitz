import { integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { seasons } from "../season/season.schema.ts";
import { teams } from "../team/team.schema.ts";

export const games = pgTable("games", {
  id: uuid("id").defaultRandom().primaryKey(),
  seasonId: uuid("season_id")
    .notNull()
    .references(() => seasons.id, { onDelete: "cascade" }),
  week: integer("week").notNull(),
  homeTeamId: uuid("home_team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  awayTeamId: uuid("away_team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
