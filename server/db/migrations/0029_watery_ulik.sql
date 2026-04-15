CREATE TYPE "public"."contract_type" AS ENUM('rookie_scale', 'veteran', 'extension', 'franchise_tag', 'restructure');--> statement-breakpoint
ALTER TABLE "contract_history" ADD COLUMN "contract_type" "contract_type" DEFAULT 'veteran' NOT NULL;--> statement-breakpoint
ALTER TABLE "contract_history" ADD COLUMN "signing_bonus" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "contract_type" "contract_type" DEFAULT 'veteran' NOT NULL;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "signed_in_year" integer;