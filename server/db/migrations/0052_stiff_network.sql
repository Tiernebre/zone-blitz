CREATE TABLE "scout_ratings" (
	"scout_id" uuid PRIMARY KEY NOT NULL,
	"accuracy" integer NOT NULL,
	"accuracy_ceiling" integer NOT NULL,
	"projection" integer NOT NULL,
	"projection_ceiling" integer NOT NULL,
	"intangible_read" integer NOT NULL,
	"intangible_read_ceiling" integer NOT NULL,
	"confidence_calibration" integer NOT NULL,
	"confidence_calibration_ceiling" integer NOT NULL,
	"bias_resistance" integer NOT NULL,
	"bias_resistance_ceiling" integer NOT NULL,
	"growth_rate" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scout_ratings" ADD CONSTRAINT "scout_ratings_scout_id_scouts_id_fk" FOREIGN KEY ("scout_id") REFERENCES "public"."scouts"("id") ON DELETE cascade ON UPDATE no action;