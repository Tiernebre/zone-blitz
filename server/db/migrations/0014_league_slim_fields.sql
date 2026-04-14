ALTER TABLE "leagues" DROP COLUMN "number_of_teams";--> statement-breakpoint
ALTER TABLE "leagues" DROP COLUMN "season_length";--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "user_team_id" uuid;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_user_team_id_teams_id_fk" FOREIGN KEY ("user_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
