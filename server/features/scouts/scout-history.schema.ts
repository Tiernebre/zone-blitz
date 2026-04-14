import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { scouts } from "./scout.schema.ts";
import { draftProspects } from "../players/player.schema.ts";

export const scoutEvaluationLevelEnum = pgEnum("scout_evaluation_level", [
  "quick",
  "standard",
  "deep",
]);

export const scoutEvaluationOutcomeEnum = pgEnum("scout_evaluation_outcome", [
  "starter",
  "contributor",
  "bust",
  "unknown",
]);

export const scoutRoundTierEnum = pgEnum("scout_round_tier", [
  "1-3",
  "4-5",
  "6-7",
  "UDFA",
]);

export const scoutCrossCheckWinnerEnum = pgEnum("scout_cross_check_winner", [
  "this",
  "other",
  "tie",
  "pending",
]);

export const scoutConnectionRelationEnum = pgEnum(
  "scout_connection_relation",
  ["worked_under", "peer", "mentee"],
);

export const scoutReputationLabels = pgTable("scout_reputation_labels", {
  id: uuid("id").defaultRandom().primaryKey(),
  scoutId: uuid("scout_id")
    .notNull()
    .references(() => scouts.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const scoutCareerStops = pgTable("scout_career_stops", {
  id: uuid("id").defaultRandom().primaryKey(),
  scoutId: uuid("scout_id")
    .notNull()
    .references(() => scouts.id, { onDelete: "cascade" }),
  orgName: text("org_name").notNull(),
  role: text("role").notNull(),
  startYear: integer("start_year").notNull(),
  endYear: integer("end_year"),
  coverageNotes: text("coverage_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * An evaluation a scout wrote for a prospect. Grade is the scout's own
 * written verdict (string, never numeric) plus the depth of evaluation
 * and what actually happened to the player. Outcome is filled in
 * retrospectively by the sim.
 */
export const scoutEvaluations = pgTable("scout_evaluations", {
  id: uuid("id").defaultRandom().primaryKey(),
  scoutId: uuid("scout_id")
    .notNull()
    .references(() => scouts.id, { onDelete: "cascade" }),
  prospectId: uuid("prospect_id").references(() => draftProspects.id, {
    onDelete: "set null",
  }),
  prospectName: text("prospect_name").notNull(),
  draftYear: integer("draft_year").notNull(),
  positionGroup: text("position_group").notNull(),
  roundTier: scoutRoundTierEnum("round_tier").notNull(),
  grade: text("grade").notNull(),
  evaluationLevel: scoutEvaluationLevelEnum("evaluation_level").notNull(),
  outcome: scoutEvaluationOutcomeEnum("outcome").notNull().default("unknown"),
  outcomeDetail: text("outcome_detail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const scoutCrossChecks = pgTable("scout_cross_checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  evaluationId: uuid("evaluation_id")
    .notNull()
    .references(() => scoutEvaluations.id, { onDelete: "cascade" }),
  otherScoutId: uuid("other_scout_id").references(
    (): AnyPgColumn => scouts.id,
    { onDelete: "set null" },
  ),
  otherGrade: text("other_grade").notNull(),
  winner: scoutCrossCheckWinnerEnum("winner").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Aggregated, noisy, secondhand record of a scout's work at previous
 * organizations. `noisyHitRateLabel` is a string label — never numeric —
 * clearly marked lower-confidence on the client.
 */
export const scoutExternalTrackRecord = pgTable(
  "scout_external_track_record",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scoutId: uuid("scout_id")
      .notNull()
      .references(() => scouts.id, { onDelete: "cascade" }),
    orgName: text("org_name").notNull(),
    startYear: integer("start_year").notNull(),
    endYear: integer("end_year"),
    noisyHitRateLabel: text("noisy_hit_rate_label").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
);

export const scoutConnections = pgTable("scout_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  scoutId: uuid("scout_id")
    .notNull()
    .references(() => scouts.id, { onDelete: "cascade" }),
  otherScoutId: uuid("other_scout_id")
    .notNull()
    .references((): AnyPgColumn => scouts.id, { onDelete: "cascade" }),
  relation: scoutConnectionRelationEnum("relation").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
