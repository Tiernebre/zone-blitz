ALTER TABLE "league_advance_vote" ALTER COLUMN "phase" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "league_clock" ALTER COLUMN "phase" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "league_phase_step" ALTER COLUMN "phase" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."league_phase";--> statement-breakpoint
CREATE TYPE "public"."league_phase" AS ENUM('genesis_staff_hiring', 'genesis_founding_pool', 'genesis_allocation_draft', 'genesis_free_agency', 'genesis_kickoff', 'offseason_review', 'coaching_carousel', 'tag_window', 'restricted_fa', 'legal_tampering', 'free_agency', 'pre_draft', 'draft', 'udfa', 'offseason_program', 'preseason', 'regular_season', 'playoffs', 'offseason_rollover');--> statement-breakpoint
ALTER TABLE "league_advance_vote" ALTER COLUMN "phase" SET DATA TYPE "public"."league_phase" USING "phase"::"public"."league_phase";--> statement-breakpoint
ALTER TABLE "league_clock" ALTER COLUMN "phase" SET DATA TYPE "public"."league_phase" USING "phase"::"public"."league_phase";--> statement-breakpoint
ALTER TABLE "league_phase_step" ALTER COLUMN "phase" SET DATA TYPE "public"."league_phase" USING "phase"::"public"."league_phase";