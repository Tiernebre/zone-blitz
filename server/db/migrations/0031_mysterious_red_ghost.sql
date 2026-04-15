ALTER TABLE "league_clock" ADD COLUMN "override_reason" text;--> statement-breakpoint
ALTER TABLE "league_clock" ADD COLUMN "override_blockers" jsonb;