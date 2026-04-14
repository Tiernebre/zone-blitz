CREATE TABLE "colleges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"nickname" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"conference" text NOT NULL,
	"subdivision" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "colleges_name_unique" UNIQUE("name")
);
