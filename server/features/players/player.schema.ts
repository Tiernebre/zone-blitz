import {
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { PLAYER_INJURY_STATUSES, PLAYER_POSITIONS } from "@zone-blitz/shared";
import { leagues } from "../league/league.schema.ts";
import { teams } from "../team/team.schema.ts";
import { seasons } from "../season/season.schema.ts";

export const playerPositionEnum = pgEnum("player_position", PLAYER_POSITIONS);
export const playerInjuryStatusEnum = pgEnum(
  "player_injury_status",
  PLAYER_INJURY_STATUSES,
);

export const players = pgTable("players", {
  id: uuid("id").defaultRandom().primaryKey(),
  leagueId: uuid("league_id")
    .notNull()
    .references(() => leagues.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  position: playerPositionEnum("position").notNull(),
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
});

export const draftProspects = pgTable("draft_prospects", {
  id: uuid("id").defaultRandom().primaryKey(),
  seasonId: uuid("season_id")
    .notNull()
    .references(() => seasons.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  position: playerPositionEnum("position").notNull(),
  heightInches: integer("height_inches").notNull(),
  weightPounds: integer("weight_pounds").notNull(),
  college: text("college"),
  birthDate: date("birth_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
