import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  DEPTH_CHART_SLOT_CODES,
  PLAYER_INJURY_STATUSES,
  PLAYER_STATUSES,
} from "@zone-blitz/shared";
import { leagues } from "../league/league.schema.ts";
import { teams } from "../team/team.schema.ts";

// Kept under the legacy `player_position` postgres enum name to avoid an
// invasive DB rename; only used by depth_chart_entries.slot_code going
// forward. Players themselves have no position column per ADR 0006.
export const depthChartSlotEnum = pgEnum(
  "player_position",
  DEPTH_CHART_SLOT_CODES,
);
export const playerInjuryStatusEnum = pgEnum(
  "player_injury_status",
  PLAYER_INJURY_STATUSES,
);
export const playerStatusEnum = pgEnum("player_status", PLAYER_STATUSES);

export const players = pgTable("players", {
  id: uuid("id").defaultRandom().primaryKey(),
  leagueId: uuid("league_id")
    .notNull()
    .references(() => leagues.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  status: playerStatusEnum("status").notNull().default("active"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  injuryStatus: playerInjuryStatusEnum("injury_status")
    .notNull()
    .default("healthy"),
  heightInches: integer("height_inches").notNull(),
  weightPounds: integer("weight_pounds").notNull(),
  college: text("college"),
  hometown: text("hometown"),
  birthDate: date("birth_date").notNull(),
  draftYear: integer("draft_year"),
  draftRound: integer("draft_round"),
  draftPick: integer("draft_pick"),
  draftingTeamId: uuid("drafting_team_id").references(() => teams.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("players_prospect_idx")
    .on(table.status)
    .where(sql`${table.status} = 'prospect'`),
]);
