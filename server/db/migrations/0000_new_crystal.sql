CREATE TABLE "health_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"checked_at" timestamp DEFAULT now() NOT NULL
);
