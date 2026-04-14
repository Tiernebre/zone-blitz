CREATE TYPE "public"."scout_connection_relation" AS ENUM('worked_under', 'peer', 'mentee');--> statement-breakpoint
CREATE TYPE "public"."scout_cross_check_winner" AS ENUM('this', 'other', 'tie', 'pending');--> statement-breakpoint
CREATE TYPE "public"."scout_evaluation_level" AS ENUM('quick', 'standard', 'deep');--> statement-breakpoint
CREATE TYPE "public"."scout_evaluation_outcome" AS ENUM('starter', 'contributor', 'bust', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."scout_role" AS ENUM('DIRECTOR', 'NATIONAL_CROSS_CHECKER', 'AREA_SCOUT');--> statement-breakpoint
CREATE TYPE "public"."scout_round_tier" AS ENUM('1-3', '4-5', '6-7', 'UDFA');--> statement-breakpoint
CREATE TABLE "scout_career_stops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scout_id" uuid NOT NULL,
	"org_name" text NOT NULL,
	"role" text NOT NULL,
	"start_year" integer NOT NULL,
	"end_year" integer,
	"coverage_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scout_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scout_id" uuid NOT NULL,
	"other_scout_id" uuid NOT NULL,
	"relation" "scout_connection_relation" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scout_cross_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"other_scout_id" uuid,
	"other_grade" text NOT NULL,
	"winner" "scout_cross_check_winner" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scout_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scout_id" uuid NOT NULL,
	"prospect_id" uuid,
	"prospect_name" text NOT NULL,
	"draft_year" integer NOT NULL,
	"position_group" text NOT NULL,
	"round_tier" "scout_round_tier" NOT NULL,
	"grade" text NOT NULL,
	"evaluation_level" "scout_evaluation_level" NOT NULL,
	"outcome" "scout_evaluation_outcome" DEFAULT 'unknown' NOT NULL,
	"outcome_detail" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scout_external_track_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scout_id" uuid NOT NULL,
	"org_name" text NOT NULL,
	"start_year" integer NOT NULL,
	"end_year" integer,
	"noisy_hit_rate_label" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scout_reputation_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scout_id" uuid NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scouts" ADD COLUMN "role" "scout_role" DEFAULT 'AREA_SCOUT' NOT NULL;--> statement-breakpoint
ALTER TABLE "scouts" ADD COLUMN "reports_to_id" uuid;--> statement-breakpoint
ALTER TABLE "scouts" ADD COLUMN "coverage" text;--> statement-breakpoint
ALTER TABLE "scouts" ADD COLUMN "age" integer DEFAULT 40 NOT NULL;--> statement-breakpoint
ALTER TABLE "scouts" ADD COLUMN "hired_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "scouts" ADD COLUMN "contract_years" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "scouts" ADD COLUMN "contract_salary" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scouts" ADD COLUMN "contract_buyout" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scouts" ADD COLUMN "work_capacity" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "scouts" ADD COLUMN "is_vacancy" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "scout_career_stops" ADD CONSTRAINT "scout_career_stops_scout_id_scouts_id_fk" FOREIGN KEY ("scout_id") REFERENCES "public"."scouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scout_connections" ADD CONSTRAINT "scout_connections_scout_id_scouts_id_fk" FOREIGN KEY ("scout_id") REFERENCES "public"."scouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scout_connections" ADD CONSTRAINT "scout_connections_other_scout_id_scouts_id_fk" FOREIGN KEY ("other_scout_id") REFERENCES "public"."scouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scout_cross_checks" ADD CONSTRAINT "scout_cross_checks_evaluation_id_scout_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."scout_evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scout_cross_checks" ADD CONSTRAINT "scout_cross_checks_other_scout_id_scouts_id_fk" FOREIGN KEY ("other_scout_id") REFERENCES "public"."scouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scout_evaluations" ADD CONSTRAINT "scout_evaluations_scout_id_scouts_id_fk" FOREIGN KEY ("scout_id") REFERENCES "public"."scouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scout_evaluations" ADD CONSTRAINT "scout_evaluations_prospect_id_draft_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."draft_prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scout_external_track_record" ADD CONSTRAINT "scout_external_track_record_scout_id_scouts_id_fk" FOREIGN KEY ("scout_id") REFERENCES "public"."scouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scout_reputation_labels" ADD CONSTRAINT "scout_reputation_labels_scout_id_scouts_id_fk" FOREIGN KEY ("scout_id") REFERENCES "public"."scouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scouts" ADD CONSTRAINT "scouts_reports_to_id_scouts_id_fk" FOREIGN KEY ("reports_to_id") REFERENCES "public"."scouts"("id") ON DELETE set null ON UPDATE no action;