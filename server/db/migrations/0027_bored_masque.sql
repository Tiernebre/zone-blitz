CREATE TYPE "public"."league_phase" AS ENUM('offseason_review', 'coaching_carousel', 'tag_window', 'restricted_fa', 'legal_tampering', 'free_agency', 'pre_draft', 'draft', 'udfa', 'offseason_program', 'preseason', 'regular_season', 'playoffs', 'offseason_rollover');--> statement-breakpoint
CREATE TYPE "public"."step_kind" AS ENUM('event', 'week', 'window');--> statement-breakpoint
CREATE TABLE "league_advance_vote" (
	"league_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"phase" "league_phase" NOT NULL,
	"step_index" integer NOT NULL,
	"ready_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "league_advance_vote_league_id_team_id_phase_step_index_pk" PRIMARY KEY("league_id","team_id","phase","step_index")
);
--> statement-breakpoint
CREATE TABLE "league_clock" (
	"league_id" uuid PRIMARY KEY NOT NULL,
	"season_year" integer NOT NULL,
	"phase" "league_phase" NOT NULL,
	"step_index" integer DEFAULT 0 NOT NULL,
	"advanced_at" timestamp DEFAULT now() NOT NULL,
	"advanced_by_user_id" text
);
--> statement-breakpoint
CREATE TABLE "league_phase_step" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase" "league_phase" NOT NULL,
	"step_index" integer NOT NULL,
	"slug" text NOT NULL,
	"kind" "step_kind" NOT NULL,
	"flavor_date" text
);
--> statement-breakpoint
ALTER TABLE "league_advance_vote" ADD CONSTRAINT "league_advance_vote_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_advance_vote" ADD CONSTRAINT "league_advance_vote_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_clock" ADD CONSTRAINT "league_clock_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_clock" ADD CONSTRAINT "league_clock_advanced_by_user_id_users_id_fk" FOREIGN KEY ("advanced_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;