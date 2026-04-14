CREATE TYPE "public"."player_injury_status" AS ENUM('healthy', 'questionable', 'doubtful', 'out', 'ir', 'pup');--> statement-breakpoint
CREATE TYPE "public"."player_position" AS ENUM('QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P', 'LS');--> statement-breakpoint
CREATE TABLE "depth_chart_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"position" "player_position" NOT NULL,
	"slot_ordinal" integer NOT NULL,
	"is_inactive" boolean DEFAULT false NOT NULL,
	"published_by_coach_id" uuid,
	"published_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "depth_chart_entries_team_position_slot_unique" UNIQUE("team_id","position","slot_ordinal"),
	CONSTRAINT "depth_chart_entries_team_player_unique" UNIQUE("team_id","player_id")
);
--> statement-breakpoint
ALTER TABLE "draft_prospects" ADD COLUMN "position" "player_position" DEFAULT 'QB' NOT NULL;--> statement-breakpoint
ALTER TABLE "draft_prospects" ALTER COLUMN "position" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "position" "player_position" DEFAULT 'QB' NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ALTER COLUMN "position" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "injury_status" "player_injury_status" DEFAULT 'healthy' NOT NULL;--> statement-breakpoint
ALTER TABLE "depth_chart_entries" ADD CONSTRAINT "depth_chart_entries_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depth_chart_entries" ADD CONSTRAINT "depth_chart_entries_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depth_chart_entries" ADD CONSTRAINT "depth_chart_entries_published_by_coach_id_coaches_id_fk" FOREIGN KEY ("published_by_coach_id") REFERENCES "public"."coaches"("id") ON DELETE set null ON UPDATE no action;