ALTER TYPE "public"."league_phase" ADD VALUE 'genesis_charter' BEFORE 'offseason_review';--> statement-breakpoint
ALTER TYPE "public"."league_phase" ADD VALUE 'genesis_franchise_establishment' BEFORE 'offseason_review';--> statement-breakpoint
ALTER TYPE "public"."league_phase" ADD VALUE 'genesis_staff_hiring' BEFORE 'offseason_review';--> statement-breakpoint
ALTER TYPE "public"."league_phase" ADD VALUE 'genesis_founding_pool' BEFORE 'offseason_review';--> statement-breakpoint
ALTER TYPE "public"."league_phase" ADD VALUE 'genesis_allocation_draft' BEFORE 'offseason_review';--> statement-breakpoint
ALTER TYPE "public"."league_phase" ADD VALUE 'genesis_free_agency' BEFORE 'offseason_review';--> statement-breakpoint
ALTER TYPE "public"."league_phase" ADD VALUE 'genesis_kickoff' BEFORE 'offseason_review';--> statement-breakpoint
ALTER TABLE "league_clock" ADD COLUMN "has_completed_genesis" boolean DEFAULT false NOT NULL;