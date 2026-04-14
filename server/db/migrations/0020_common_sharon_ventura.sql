-- 1. Detach scout_evaluations.prospect_id from draft_prospects. We will point
--    it back at the unified players table once data has been migrated. The
--    existing uuid values in prospect_id remain valid — we preserve them as
--    the new players.id.
ALTER TABLE "scout_evaluations" DROP CONSTRAINT "scout_evaluations_prospect_id_draft_prospects_id_fk";
--> statement-breakpoint

-- 2. Promote every draft_prospects row into players with status = 'prospect'.
--    We preserve the original uuid so that scout_evaluations.prospect_id keeps
--    pointing at the same logical player without a lookup table. Draft-origin
--    columns (hometown, draft_year, etc.) stay NULL — prospects haven't been
--    drafted yet, so they have no draft slot to record.
INSERT INTO "players" (
  "id", "league_id", "team_id", "status", "first_name", "last_name",
  "position", "injury_status", "height_inches", "weight_pounds",
  "college", "birth_date", "created_at", "updated_at"
)
SELECT dp.id, s.league_id, NULL, 'prospect', dp.first_name, dp.last_name,
       dp.position, 'healthy', dp.height_inches, dp.weight_pounds,
       dp.college, dp.birth_date, dp.created_at, dp.updated_at
FROM "draft_prospects" dp
JOIN "seasons" s ON s.id = dp.season_id;
--> statement-breakpoint

-- 3. Copy the draft prospect's ratings into player_attributes, keyed by the
--    shared uuid (dp.id == players.id).
INSERT INTO "player_attributes"
  SELECT * FROM "draft_prospect_attributes";
--> statement-breakpoint

-- 4. Seed the immutable pre-draft snapshot from the same source. draft_class_year
--    is pulled from the season's year; projected_round and scouting_notes stay
--    NULL until scouting flows populate them.
INSERT INTO "player_draft_profile" (
  "player_id", "season_id", "draft_class_year", "projected_round", "scouting_notes",
  "speed", "speed_potential", "acceleration", "acceleration_potential",
  "agility", "agility_potential", "strength", "strength_potential",
  "jumping", "jumping_potential", "stamina", "stamina_potential",
  "durability", "durability_potential", "arm_strength", "arm_strength_potential",
  "accuracy_short", "accuracy_short_potential",
  "accuracy_medium", "accuracy_medium_potential",
  "accuracy_deep", "accuracy_deep_potential",
  "accuracy_on_the_run", "accuracy_on_the_run_potential",
  "touch", "touch_potential",
  "release", "release_potential",
  "ball_carrying", "ball_carrying_potential",
  "elusiveness", "elusiveness_potential",
  "route_running", "route_running_potential",
  "catching", "catching_potential",
  "contested_catching", "contested_catching_potential",
  "run_after_catch", "run_after_catch_potential",
  "pass_blocking", "pass_blocking_potential",
  "run_blocking", "run_blocking_potential",
  "block_shedding", "block_shedding_potential",
  "tackling", "tackling_potential",
  "man_coverage", "man_coverage_potential",
  "zone_coverage", "zone_coverage_potential",
  "pass_rushing", "pass_rushing_potential",
  "run_defense", "run_defense_potential",
  "kicking_power", "kicking_power_potential",
  "kicking_accuracy", "kicking_accuracy_potential",
  "punting_power", "punting_power_potential",
  "punting_accuracy", "punting_accuracy_potential",
  "snap_accuracy", "snap_accuracy_potential",
  "football_iq", "football_iq_potential",
  "decision_making", "decision_making_potential",
  "anticipation", "anticipation_potential",
  "composure", "composure_potential",
  "clutch", "clutch_potential",
  "consistency", "consistency_potential",
  "work_ethic", "work_ethic_potential",
  "coachability", "coachability_potential",
  "leadership", "leadership_potential",
  "greed", "greed_potential",
  "loyalty", "loyalty_potential",
  "ambition", "ambition_potential",
  "vanity", "vanity_potential",
  "scheme_attachment", "scheme_attachment_potential",
  "media_sensitivity", "media_sensitivity_potential",
  "created_at"
)
SELECT
  dpa.draft_prospect_id, dp.season_id, s.year, NULL, NULL,
  dpa.speed, dpa.speed_potential, dpa.acceleration, dpa.acceleration_potential,
  dpa.agility, dpa.agility_potential, dpa.strength, dpa.strength_potential,
  dpa.jumping, dpa.jumping_potential, dpa.stamina, dpa.stamina_potential,
  dpa.durability, dpa.durability_potential, dpa.arm_strength, dpa.arm_strength_potential,
  dpa.accuracy_short, dpa.accuracy_short_potential,
  dpa.accuracy_medium, dpa.accuracy_medium_potential,
  dpa.accuracy_deep, dpa.accuracy_deep_potential,
  dpa.accuracy_on_the_run, dpa.accuracy_on_the_run_potential,
  dpa.touch, dpa.touch_potential,
  dpa.release, dpa.release_potential,
  dpa.ball_carrying, dpa.ball_carrying_potential,
  dpa.elusiveness, dpa.elusiveness_potential,
  dpa.route_running, dpa.route_running_potential,
  dpa.catching, dpa.catching_potential,
  dpa.contested_catching, dpa.contested_catching_potential,
  dpa.run_after_catch, dpa.run_after_catch_potential,
  dpa.pass_blocking, dpa.pass_blocking_potential,
  dpa.run_blocking, dpa.run_blocking_potential,
  dpa.block_shedding, dpa.block_shedding_potential,
  dpa.tackling, dpa.tackling_potential,
  dpa.man_coverage, dpa.man_coverage_potential,
  dpa.zone_coverage, dpa.zone_coverage_potential,
  dpa.pass_rushing, dpa.pass_rushing_potential,
  dpa.run_defense, dpa.run_defense_potential,
  dpa.kicking_power, dpa.kicking_power_potential,
  dpa.kicking_accuracy, dpa.kicking_accuracy_potential,
  dpa.punting_power, dpa.punting_power_potential,
  dpa.punting_accuracy, dpa.punting_accuracy_potential,
  dpa.snap_accuracy, dpa.snap_accuracy_potential,
  dpa.football_iq, dpa.football_iq_potential,
  dpa.decision_making, dpa.decision_making_potential,
  dpa.anticipation, dpa.anticipation_potential,
  dpa.composure, dpa.composure_potential,
  dpa.clutch, dpa.clutch_potential,
  dpa.consistency, dpa.consistency_potential,
  dpa.work_ethic, dpa.work_ethic_potential,
  dpa.coachability, dpa.coachability_potential,
  dpa.leadership, dpa.leadership_potential,
  dpa.greed, dpa.greed_potential,
  dpa.loyalty, dpa.loyalty_potential,
  dpa.ambition, dpa.ambition_potential,
  dpa.vanity, dpa.vanity_potential,
  dpa.scheme_attachment, dpa.scheme_attachment_potential,
  dpa.media_sensitivity, dpa.media_sensitivity_potential,
  dpa.created_at
FROM "draft_prospect_attributes" dpa
JOIN "draft_prospects" dp ON dp.id = dpa.draft_prospect_id
JOIN "seasons" s ON s.id = dp.season_id;
--> statement-breakpoint

-- 5. Old tables are no longer needed; rows are now in players / player_attributes /
--    player_draft_profile keyed by the same uuids.
ALTER TABLE "draft_prospect_attributes" DISABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "draft_prospects" DISABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP TABLE "draft_prospect_attributes" CASCADE;
--> statement-breakpoint
DROP TABLE "draft_prospects" CASCADE;
--> statement-breakpoint

-- 6. scout_evaluations.prospect_id uuids already match the promoted players.id —
--    repoint the FK.
ALTER TABLE "scout_evaluations" ADD CONSTRAINT "scout_evaluations_prospect_id_players_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;
