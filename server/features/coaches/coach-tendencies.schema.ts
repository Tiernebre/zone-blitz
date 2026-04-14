import { integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { coaches } from "./coach.schema.ts";

/**
 * Per ADR 0007, scheme tendency vectors live on coordinators (1:1 with
 * `coaches`). Offensive columns are populated only on OC / offense-side
 * HC rows; defensive columns only on DC / defense-side HC rows. All
 * tendency columns are nullable so a single DC does not carry empty
 * offensive fields (and vice versa).
 */
export const coachTendencies = pgTable("coach_tendencies", {
  coachId: uuid("coach_id")
    .primaryKey()
    .references(() => coaches.id, { onDelete: "cascade" }),
  // Offensive vector — OC / offense-side HC
  runPassLean: integer("run_pass_lean"),
  tempo: integer("tempo"),
  personnelWeight: integer("personnel_weight"),
  formationUnderCenterShotgun: integer("formation_under_center_shotgun"),
  preSnapMotionRate: integer("pre_snap_motion_rate"),
  passingStyle: integer("passing_style"),
  passingDepth: integer("passing_depth"),
  runGameBlocking: integer("run_game_blocking"),
  rpoIntegration: integer("rpo_integration"),
  // Defensive vector — DC / defense-side HC
  frontOddEven: integer("front_odd_even"),
  gapResponsibility: integer("gap_responsibility"),
  subPackageLean: integer("sub_package_lean"),
  coverageManZone: integer("coverage_man_zone"),
  coverageShell: integer("coverage_shell"),
  cornerPressOff: integer("corner_press_off"),
  pressureRate: integer("pressure_rate"),
  disguiseRate: integer("disguise_rate"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
