CREATE TABLE "franchises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"city_id" uuid NOT NULL,
	"abbreviation" text NOT NULL,
	"primary_color" text NOT NULL,
	"secondary_color" text NOT NULL,
	"accent_color" text NOT NULL,
	"conference" text NOT NULL,
	"division" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "franchises_abbreviation_unique" UNIQUE("abbreviation")
);
--> statement-breakpoint
TRUNCATE TABLE "teams" CASCADE;--> statement-breakpoint
ALTER TABLE "teams" DROP CONSTRAINT "teams_abbreviation_unique";--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "league_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "franchise_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "franchises" ADD CONSTRAINT "franchises_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_franchise_id_franchises_id_fk" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_league_id_franchise_id_unique" UNIQUE("league_id","franchise_id");