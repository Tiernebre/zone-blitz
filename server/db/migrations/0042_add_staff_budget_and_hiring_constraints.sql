ALTER TABLE "leagues" ADD COLUMN "staff_budget" integer DEFAULT 50000000 NOT NULL;--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "interest_cap" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "interviews_per_week" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "max_concurrent_offers" integer DEFAULT 5 NOT NULL;