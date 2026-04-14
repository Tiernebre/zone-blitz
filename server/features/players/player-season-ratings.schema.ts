import { pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { players } from "./player.schema.ts";
import { seasons } from "../season/season.schema.ts";
import { attributeColumns, attributeRangeChecks } from "./attributes.schema.ts";

/**
 * Year-over-year rating history for a player. One row per (player, season)
 * captures that season's attribute snapshot so the career arc is preserved
 * without overwriting.
 */
export const playerSeasonRatings = pgTable(
  "player_season_ratings",
  {
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    ...attributeColumns(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.playerId, table.seasonId],
      name: "player_season_ratings_pk",
    }),
    ...Object.values(attributeRangeChecks("player_season_ratings")),
  ],
);
