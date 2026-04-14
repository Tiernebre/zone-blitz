CREATE TYPE "public"."player_transaction_type" AS ENUM('drafted', 'signed', 'released', 'traded', 'extended', 'franchise_tagged');--> statement-breakpoint
CREATE TABLE "player_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"team_id" uuid,
	"counterparty_team_id" uuid,
	"type" "player_transaction_type" NOT NULL,
	"season_year" integer NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"detail" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_transactions" ADD CONSTRAINT "player_transactions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_transactions" ADD CONSTRAINT "player_transactions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_transactions" ADD CONSTRAINT "player_transactions_counterparty_team_id_teams_id_fk" FOREIGN KEY ("counterparty_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;