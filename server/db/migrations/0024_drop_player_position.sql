-- Clean up legacy draft_prospects tables whose removal from schema.ts
-- predates this PR but was never captured in a migration. Safe here because
-- 0017_scouts_staff_and_history migrated all prospect data into the players
-- table.
ALTER TABLE IF EXISTS "draft_prospect_attributes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "draft_prospects" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "draft_prospect_attributes" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "draft_prospects" CASCADE;--> statement-breakpoint
ALTER TABLE "scout_evaluations" DROP CONSTRAINT IF EXISTS "scout_evaluations_prospect_id_draft_prospects_id_fk";--> statement-breakpoint
ALTER TABLE "scout_evaluations" DROP CONSTRAINT IF EXISTS "scout_evaluations_prospect_id_players_id_fk";--> statement-breakpoint
ALTER TABLE "scout_evaluations" ADD CONSTRAINT "scout_evaluations_prospect_id_players_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Players are positionless. Drop the persisted position column.
-- The `player_position` postgres enum is retained because depth_chart_entries
-- still uses it as a slot code.
ALTER TABLE "players" DROP COLUMN "position";
