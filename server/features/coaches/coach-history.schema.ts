import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { coaches } from "./coach.schema.ts";
import { players } from "../players/player.schema.ts";
import { teams } from "../team/team.schema.ts";

export const tenureUnitSideEnum = pgEnum("coach_tenure_unit_side", [
  "offense",
  "defense",
  "special_teams",
]);

export const playerDevDeltaEnum = pgEnum("coach_player_dev_delta", [
  "improved",
  "stagnated",
  "regressed",
]);

export const accoladeTypeEnum = pgEnum("coach_accolade_type", [
  "coy_vote",
  "championship",
  "position_pro_bowl",
  "other",
]);

export const connectionRelationEnum = pgEnum("coach_connection_relation", [
  "mentor",
  "mentee",
  "peer",
]);

/**
 * A stop on a coach's career resume — previous (or current) team, role,
 * years, and the team's record or unit rank during his tenure where
 * applicable. Public-record data only.
 */
export const coachCareerStops = pgTable("coach_career_stops", {
  id: uuid("id").defaultRandom().primaryKey(),
  coachId: uuid("coach_id")
    .notNull()
    .references(() => coaches.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").references(() => teams.id, {
    onDelete: "set null",
  }),
  teamName: text("team_name").notNull(),
  role: text("role").notNull(),
  startYear: integer("start_year").notNull(),
  endYear: integer("end_year"),
  teamWins: integer("team_wins"),
  teamLosses: integer("team_losses"),
  teamTies: integer("team_ties"),
  unitRank: integer("unit_rank"),
  unitSide: tenureUnitSideEnum("unit_side"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * League-generated reputation labels (e.g. "offensive innovator",
 * "players' coach"). Labels only, no numeric backing.
 */
export const coachReputationLabels = pgTable("coach_reputation_labels", {
  id: uuid("id").defaultRandom().primaryKey(),
  coachId: uuid("coach_id")
    .notNull()
    .references(() => coaches.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Season-by-season unit performance for a coach under his current team.
 * `metrics` holds scheme tendencies (run-pass split, blitz rate, formation
 * usage — whatever applies to the role).
 */
export const coachTenureUnitPerformance = pgTable(
  "coach_tenure_unit_performance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    coachId: uuid("coach_id")
      .notNull()
      .references(() => coaches.id, { onDelete: "cascade" }),
    season: integer("season").notNull(),
    unitSide: tenureUnitSideEnum("unit_side").notNull(),
    rank: integer("rank").notNull(),
    metrics: jsonb("metrics"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
);

/**
 * Per-player development trajectory under a coach for a given season —
 * improved / stagnated / regressed, with optional flavor note.
 */
export const coachTenurePlayerDev = pgTable("coach_tenure_player_dev", {
  id: uuid("id").defaultRandom().primaryKey(),
  coachId: uuid("coach_id")
    .notNull()
    .references(() => coaches.id, { onDelete: "cascade" }),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  season: integer("season").notNull(),
  delta: playerDevDeltaEnum("delta").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Awards, votes, championships, Pro Bowl selections attributable to a
 * coach's position group.
 */
export const coachAccolades = pgTable("coach_accolades", {
  id: uuid("id").defaultRandom().primaryKey(),
  coachId: uuid("coach_id")
    .notNull()
    .references(() => coaches.id, { onDelete: "cascade" }),
  season: integer("season").notNull(),
  type: accoladeTypeEnum("type").notNull(),
  detail: text("detail").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Flavor notes about notable depth-chart decisions (e.g. "started the
 * veteran over the rookie for N games").
 */
export const coachDepthChartNotes = pgTable("coach_depth_chart_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  coachId: uuid("coach_id")
    .notNull()
    .references(() => coaches.id, { onDelete: "cascade" }),
  season: integer("season").notNull(),
  note: text("note").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Coach-to-coach connections: mentor / mentee / peer. Powers the
 * "coaching tree lineage" and "connections" sections on the detail page.
 */
export const coachConnections = pgTable("coach_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  coachId: uuid("coach_id")
    .notNull()
    .references(() => coaches.id, { onDelete: "cascade" }),
  otherCoachId: uuid("other_coach_id")
    .notNull()
    .references((): AnyPgColumn => coaches.id, { onDelete: "cascade" }),
  relation: connectionRelationEnum("relation").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
