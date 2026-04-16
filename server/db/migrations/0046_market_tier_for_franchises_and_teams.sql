CREATE TYPE "public"."market_tier" AS ENUM('large', 'medium', 'small');--> statement-breakpoint
ALTER TABLE "franchises" ADD COLUMN "market_tier" "market_tier" DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "market_tier" "market_tier" DEFAULT 'medium' NOT NULL;--> statement-breakpoint
UPDATE "franchises" SET "market_tier" = 'large'  WHERE "abbreviation" = 'SDG';--> statement-breakpoint
UPDATE "franchises" SET "market_tier" = 'medium' WHERE "abbreviation" IN ('PDX', 'SAC', 'SLC');--> statement-breakpoint
UPDATE "franchises" SET "market_tier" = 'small'  WHERE "abbreviation" IN ('RNO', 'BOI', 'HNL', 'ABQ');--> statement-breakpoint
UPDATE "teams" t SET "market_tier" = f."market_tier" FROM "franchises" f WHERE t."franchise_id" = f."id";
