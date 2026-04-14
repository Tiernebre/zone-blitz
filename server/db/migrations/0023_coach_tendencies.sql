CREATE TABLE "coach_tendencies" (
	"coach_id" uuid PRIMARY KEY NOT NULL,
	"run_pass_lean" integer,
	"tempo" integer,
	"personnel_weight" integer,
	"formation_under_center_shotgun" integer,
	"pre_snap_motion_rate" integer,
	"passing_style" integer,
	"passing_depth" integer,
	"run_game_blocking" integer,
	"rpo_integration" integer,
	"front_odd_even" integer,
	"gap_responsibility" integer,
	"sub_package_lean" integer,
	"coverage_man_zone" integer,
	"coverage_shell" integer,
	"corner_press_off" integer,
	"pressure_rate" integer,
	"disguise_rate" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coach_tendencies" ADD CONSTRAINT "coach_tendencies_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE cascade ON UPDATE no action;
