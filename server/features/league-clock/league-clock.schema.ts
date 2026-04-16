import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { leagues } from "../league/league.schema.ts";
import { users } from "../auth/auth.schema.ts";
import { teams } from "../team/team.schema.ts";

export const leaguePhaseEnum = pgEnum("league_phase", [
  "genesis_staff_hiring",
  "genesis_founding_pool",
  "genesis_draft_scouting",
  "genesis_allocation_draft",
  "genesis_free_agency",
  "genesis_kickoff",
  "offseason_review",
  "coaching_carousel",
  "tag_window",
  "restricted_fa",
  "legal_tampering",
  "free_agency",
  "pre_draft",
  "draft",
  "udfa",
  "offseason_program",
  "preseason",
  "regular_season",
  "playoffs",
  "offseason_rollover",
]);

export const stepKindEnum = pgEnum("step_kind", ["event", "week", "window"]);

export const leagueClock = pgTable("league_clock", {
  leagueId: uuid("league_id")
    .primaryKey()
    .references(() => leagues.id, { onDelete: "cascade" }),
  seasonYear: integer("season_year").notNull(),
  phase: leaguePhaseEnum("phase").notNull(),
  stepIndex: integer("step_index").notNull().default(0),
  advancedAt: timestamp("advanced_at").defaultNow().notNull(),
  advancedByUserId: text("advanced_by_user_id").references(() => users.id),
  overrideReason: text("override_reason"),
  overrideBlockers: jsonb("override_blockers"),
  hasCompletedGenesis: boolean("has_completed_genesis").notNull().default(
    false,
  ),
});

export const leaguePhaseStep = pgTable("league_phase_step", {
  id: uuid("id").primaryKey().defaultRandom(),
  phase: leaguePhaseEnum("phase").notNull(),
  stepIndex: integer("step_index").notNull(),
  slug: text("slug").notNull(),
  kind: stepKindEnum("kind").notNull(),
  flavorDate: text("flavor_date"),
});

export const leagueAdvanceVote = pgTable(
  "league_advance_vote",
  {
    leagueId: uuid("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    phase: leaguePhaseEnum("phase").notNull(),
    stepIndex: integer("step_index").notNull(),
    readyAt: timestamp("ready_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.leagueId, table.teamId, table.phase, table.stepIndex],
    }),
  ],
);
