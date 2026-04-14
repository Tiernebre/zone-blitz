import {
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { players } from "./player.schema.ts";
import { seasons } from "../season/season.schema.ts";
import { attributeColumns, attributeRangeChecks } from "./attributes.schema.ts";

/**
 * Immutable pre-draft snapshot for a player. Written at prospect creation,
 * frozen once the player is drafted, never mutated thereafter.
 */
export const playerDraftProfile = pgTable(
  "player_draft_profile",
  {
    playerId: uuid("player_id")
      .primaryKey()
      .references(() => players.id, { onDelete: "cascade" }),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    draftClassYear: integer("draft_class_year").notNull(),
    projectedRound: smallint("projected_round"),
    scoutingNotes: text("scouting_notes"),
    ...attributeColumns(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  () => attributeRangeChecks("player_draft_profile"),
);
