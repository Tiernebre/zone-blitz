CREATE TYPE "public"."hiring_interest_status" AS ENUM('active', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."hiring_interview_status" AS ENUM('requested', 'accepted', 'declined', 'completed');--> statement-breakpoint
CREATE TYPE "public"."hiring_offer_status" AS ENUM('pending', 'accepted', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."staff_type" AS ENUM('coach', 'scout');--> statement-breakpoint
CREATE TABLE "hiring_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"staff_type" "staff_type" NOT NULL,
	"staff_id" uuid NOT NULL,
	"chosen_offer_id" uuid,
	"wave" integer NOT NULL,
	"decided_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hiring_interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"staff_type" "staff_type" NOT NULL,
	"staff_id" uuid NOT NULL,
	"step_slug" text NOT NULL,
	"status" "hiring_interest_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hiring_interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"staff_type" "staff_type" NOT NULL,
	"staff_id" uuid NOT NULL,
	"step_slug" text NOT NULL,
	"status" "hiring_interview_status" DEFAULT 'requested' NOT NULL,
	"philosophy_reveal" jsonb,
	"staff_fit_reveal" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hiring_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"staff_type" "staff_type" NOT NULL,
	"staff_id" uuid NOT NULL,
	"step_slug" text NOT NULL,
	"status" "hiring_offer_status" DEFAULT 'pending' NOT NULL,
	"salary" integer NOT NULL,
	"contract_years" integer NOT NULL,
	"buyout_multiplier" numeric(3, 2) NOT NULL,
	"incentives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preference_score" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "market_tier_pref" integer;--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "philosophy_fit_pref" integer;--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "staff_fit_pref" integer;--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "compensation_pref" integer;--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "minimum_threshold" integer;--> statement-breakpoint
ALTER TABLE "scouts" ADD COLUMN "market_tier_pref" integer;--> statement-breakpoint
ALTER TABLE "scouts" ADD COLUMN "philosophy_fit_pref" integer;--> statement-breakpoint
ALTER TABLE "scouts" ADD COLUMN "staff_fit_pref" integer;--> statement-breakpoint
ALTER TABLE "scouts" ADD COLUMN "compensation_pref" integer;--> statement-breakpoint
ALTER TABLE "scouts" ADD COLUMN "minimum_threshold" integer;--> statement-breakpoint
ALTER TABLE "hiring_decisions" ADD CONSTRAINT "hiring_decisions_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_decisions" ADD CONSTRAINT "hiring_decisions_chosen_offer_id_hiring_offers_id_fk" FOREIGN KEY ("chosen_offer_id") REFERENCES "public"."hiring_offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_interests" ADD CONSTRAINT "hiring_interests_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_interests" ADD CONSTRAINT "hiring_interests_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_interviews" ADD CONSTRAINT "hiring_interviews_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_interviews" ADD CONSTRAINT "hiring_interviews_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_offers" ADD CONSTRAINT "hiring_offers_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_offers" ADD CONSTRAINT "hiring_offers_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;