CREATE TABLE "coach_ratings" (
	"coach_id" uuid PRIMARY KEY NOT NULL,
	"leadership" integer NOT NULL,
	"leadership_ceiling" integer NOT NULL,
	"game_management" integer NOT NULL,
	"game_management_ceiling" integer NOT NULL,
	"scheme_mastery" integer NOT NULL,
	"scheme_mastery_ceiling" integer NOT NULL,
	"player_development" integer NOT NULL,
	"player_development_ceiling" integer NOT NULL,
	"adaptability" integer NOT NULL,
	"adaptability_ceiling" integer NOT NULL,
	"growth_rate" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coach_ratings" ADD CONSTRAINT "coach_ratings_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE cascade ON UPDATE no action;