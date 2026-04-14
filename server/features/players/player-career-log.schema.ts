import {
  boolean,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { players } from "./player.schema.ts";
import { teams } from "../team/team.schema.ts";

export const playerSeasonStats = pgTable(
  "player_season_stats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    seasonYear: integer("season_year").notNull(),
    playoffs: boolean("playoffs").notNull().default(false),
    gamesPlayed: integer("games_played").notNull().default(0),
    gamesStarted: integer("games_started").notNull().default(0),
    stats: jsonb("stats").notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("player_season_stats_unique").on(
      table.playerId,
      table.seasonYear,
      table.teamId,
      table.playoffs,
    ),
  ],
);
