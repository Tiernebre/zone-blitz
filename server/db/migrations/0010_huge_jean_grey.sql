-- The new coach shape is not backfill-compatible with the stub-generator
-- rows from the previous schema (no role, no hierarchy, no contract data).
-- Wipe existing records so NOT NULL columns can be added safely; leagues
-- will regenerate their staff under the new shape on next seed.
DELETE FROM "coaches";--> statement-breakpoint
CREATE TYPE "public"."coach_accolade_type" AS ENUM('coy_vote', 'championship', 'position_pro_bowl', 'other');--> statement-breakpoint
CREATE TYPE "public"."coach_play_caller" AS ENUM('offense', 'defense', 'ceo');--> statement-breakpoint
CREATE TYPE "public"."coach_role" AS ENUM('HC', 'OC', 'DC', 'STC', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'ST_ASSISTANT');--> statement-breakpoint
CREATE TYPE "public"."coach_specialty" AS ENUM('offense', 'defense', 'special_teams', 'quarterbacks', 'running_backs', 'wide_receivers', 'tight_ends', 'offensive_line', 'defensive_line', 'linebackers', 'defensive_backs', 'ceo');--> statement-breakpoint
CREATE TYPE "public"."coach_connection_relation" AS ENUM('mentor', 'mentee', 'peer');--> statement-breakpoint
CREATE TYPE "public"."coach_player_dev_delta" AS ENUM('improved', 'stagnated', 'regressed');--> statement-breakpoint
CREATE TYPE "public"."coach_tenure_unit_side" AS ENUM('offense', 'defense', 'special_teams');--> statement-breakpoint
CREATE TABLE "coach_accolades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"season" integer NOT NULL,
	"type" "coach_accolade_type" NOT NULL,
	"detail" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_career_stops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"team_id" uuid,
	"team_name" text NOT NULL,
	"role" text NOT NULL,
	"start_year" integer NOT NULL,
	"end_year" integer,
	"team_wins" integer,
	"team_losses" integer,
	"team_ties" integer,
	"unit_rank" integer,
	"unit_side" "coach_tenure_unit_side",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"other_coach_id" uuid NOT NULL,
	"relation" "coach_connection_relation" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_depth_chart_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"season" integer NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_reputation_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_tenure_player_dev" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"season" integer NOT NULL,
	"delta" "coach_player_dev_delta" NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_tenure_unit_performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"season" integer NOT NULL,
	"unit_side" "coach_tenure_unit_side" NOT NULL,
	"rank" integer NOT NULL,
	"metrics" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "role" "coach_role" NOT NULL;--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "reports_to_id" uuid;--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "play_caller" "coach_play_caller";--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "age" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "hired_at" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "contract_years" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "contract_salary" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "contract_buyout" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "college_id" uuid;--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "specialty" "coach_specialty";--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "is_vacancy" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "mentor_coach_id" uuid;--> statement-breakpoint
ALTER TABLE "coach_accolades" ADD CONSTRAINT "coach_accolades_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_career_stops" ADD CONSTRAINT "coach_career_stops_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_career_stops" ADD CONSTRAINT "coach_career_stops_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_connections" ADD CONSTRAINT "coach_connections_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_connections" ADD CONSTRAINT "coach_connections_other_coach_id_coaches_id_fk" FOREIGN KEY ("other_coach_id") REFERENCES "public"."coaches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_depth_chart_notes" ADD CONSTRAINT "coach_depth_chart_notes_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_reputation_labels" ADD CONSTRAINT "coach_reputation_labels_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_tenure_player_dev" ADD CONSTRAINT "coach_tenure_player_dev_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_tenure_player_dev" ADD CONSTRAINT "coach_tenure_player_dev_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_tenure_unit_performance" ADD CONSTRAINT "coach_tenure_unit_performance_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaches" ADD CONSTRAINT "coaches_reports_to_id_coaches_id_fk" FOREIGN KEY ("reports_to_id") REFERENCES "public"."coaches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaches" ADD CONSTRAINT "coaches_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaches" ADD CONSTRAINT "coaches_mentor_coach_id_coaches_id_fk" FOREIGN KEY ("mentor_coach_id") REFERENCES "public"."coaches"("id") ON DELETE set null ON UPDATE no action;