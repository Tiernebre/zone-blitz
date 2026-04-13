ALTER TABLE "leagues" ADD COLUMN "number_of_teams" integer DEFAULT 32 NOT NULL;--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "season_length" integer DEFAULT 17 NOT NULL;--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "salary_cap" integer DEFAULT 255000000 NOT NULL;--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "cap_floor_percent" integer DEFAULT 89 NOT NULL;--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "cap_growth_rate" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "roster_size" integer DEFAULT 53 NOT NULL;