ALTER TYPE "public"."league_phase" RENAME VALUE 'genesis_staff_hiring' TO 'initial_staff_hiring';--> statement-breakpoint
ALTER TYPE "public"."league_phase" RENAME VALUE 'genesis_founding_pool' TO 'initial_pool';--> statement-breakpoint
ALTER TYPE "public"."league_phase" RENAME VALUE 'genesis_draft_scouting' TO 'initial_scouting';--> statement-breakpoint
ALTER TYPE "public"."league_phase" RENAME VALUE 'genesis_allocation_draft' TO 'initial_draft';--> statement-breakpoint
ALTER TYPE "public"."league_phase" RENAME VALUE 'genesis_free_agency' TO 'initial_free_agency';--> statement-breakpoint
ALTER TYPE "public"."league_phase" RENAME VALUE 'genesis_kickoff' TO 'initial_kickoff';--> statement-breakpoint
ALTER TABLE "league_clock" RENAME COLUMN "has_completed_genesis" TO "has_completed_initial";--> statement-breakpoint
UPDATE "league_phase_step" SET "slug" = 'generate_initial_player_pool' WHERE "slug" = 'generate_founding_player_pool';--> statement-breakpoint
UPDATE "league_phase_step" SET "slug" = 'initial_fa_window' WHERE "slug" = 'genesis_fa_window';
