ALTER TABLE "leagues" ADD COLUMN "number_of_teams" integer DEFAULT 32 NOT NULL;--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "season_length" integer DEFAULT 17 NOT NULL;