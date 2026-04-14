CREATE TYPE "public"."contract_termination_reason" AS ENUM('active', 'expired', 'released', 'traded', 'extended', 'restructured');--> statement-breakpoint
CREATE TABLE "contract_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"signed_in_year" integer NOT NULL,
	"total_years" integer NOT NULL,
	"total_salary" integer NOT NULL,
	"guaranteed_money" integer DEFAULT 0 NOT NULL,
	"termination_reason" "contract_termination_reason" DEFAULT 'active' NOT NULL,
	"ended_in_year" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contract_history" ADD CONSTRAINT "contract_history_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_history" ADD CONSTRAINT "contract_history_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;