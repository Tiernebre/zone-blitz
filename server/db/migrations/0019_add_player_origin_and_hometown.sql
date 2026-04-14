ALTER TABLE "players" ADD COLUMN "hometown" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "draft_year" integer;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "draft_round" integer;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "draft_pick" integer;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "drafting_team_id" uuid;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_drafting_team_id_teams_id_fk" FOREIGN KEY ("drafting_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;