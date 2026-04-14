import {
  boolean,
  integer,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { teams } from "../team/team.schema.ts";
import { coaches } from "../coaches/coach.schema.ts";
import { playerPositionEnum, players } from "./player.schema.ts";

export const depthChartEntries = pgTable(
  "depth_chart_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    position: playerPositionEnum("position").notNull(),
    slotOrdinal: integer("slot_ordinal").notNull(),
    isInactive: boolean("is_inactive").notNull().default(false),
    publishedByCoachId: uuid("published_by_coach_id").references(
      () => coaches.id,
      { onDelete: "set null" },
    ),
    publishedAt: timestamp("published_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("depth_chart_entries_team_position_slot_unique").on(
      table.teamId,
      table.position,
      table.slotOrdinal,
    ),
    unique("depth_chart_entries_team_player_unique").on(
      table.teamId,
      table.playerId,
    ),
  ],
);
