CREATE TYPE "public"."player_accolade_type" AS ENUM('pro_bowl', 'all_pro_first', 'all_pro_second', 'championship', 'mvp', 'offensive_player_of_the_year', 'defensive_player_of_the_year', 'offensive_rookie_of_the_year', 'defensive_rookie_of_the_year', 'comeback_player_of_the_year', 'statistical_milestone', 'other');--> statement-breakpoint
CREATE TABLE "player_accolades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"season_year" integer NOT NULL,
	"type" "player_accolade_type" NOT NULL,
	"detail" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_season_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"season_year" integer NOT NULL,
	"playoffs" boolean DEFAULT false NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"games_started" integer DEFAULT 0 NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_accolades" ADD CONSTRAINT "player_accolades_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_season_stats" ADD CONSTRAINT "player_season_stats_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_season_stats" ADD CONSTRAINT "player_season_stats_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "player_season_stats_unique" ON "player_season_stats" USING btree ("player_id","season_year","team_id","playoffs");