TRUNCATE "contracts" CASCADE;--> statement-breakpoint
CREATE TYPE "public"."contract_bonus_source" AS ENUM('signing', 'restructure', 'option');--> statement-breakpoint
CREATE TYPE "public"."contract_guarantee_type" AS ENUM('full', 'injury', 'none');--> statement-breakpoint
CREATE TYPE "public"."contract_tag_type" AS ENUM('franchise', 'transition');--> statement-breakpoint
CREATE TABLE "contract_bonus_prorations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"first_year" integer NOT NULL,
	"years" integer NOT NULL,
	"source" "contract_bonus_source" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_option_bonuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"exercise_year" integer NOT NULL,
	"proration_years" integer NOT NULL,
	"exercised_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "contract_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"league_year" integer NOT NULL,
	"base" integer DEFAULT 0 NOT NULL,
	"roster_bonus" integer DEFAULT 0 NOT NULL,
	"workout_bonus" integer DEFAULT 0 NOT NULL,
	"per_game_roster_bonus" integer DEFAULT 0 NOT NULL,
	"guarantee_type" "contract_guarantee_type" DEFAULT 'none' NOT NULL,
	"is_void" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "signed_year" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "real_years" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "is_rookie_deal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "rookie_draft_pick" integer;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "tag_type" "contract_tag_type";--> statement-breakpoint
ALTER TABLE "contract_bonus_prorations" ADD CONSTRAINT "contract_bonus_prorations_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_option_bonuses" ADD CONSTRAINT "contract_option_bonuses_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_years" ADD CONSTRAINT "contract_years_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" DROP COLUMN "contract_type";--> statement-breakpoint
ALTER TABLE "contracts" DROP COLUMN "current_year";--> statement-breakpoint
ALTER TABLE "contracts" DROP COLUMN "total_salary";--> statement-breakpoint
ALTER TABLE "contracts" DROP COLUMN "annual_salary";--> statement-breakpoint
ALTER TABLE "contracts" DROP COLUMN "guaranteed_money";--> statement-breakpoint
ALTER TABLE "contracts" DROP COLUMN "signed_in_year";