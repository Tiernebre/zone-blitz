ALTER TYPE "public"."player_transaction_type" ADD VALUE 'claimed_on_waivers';--> statement-breakpoint
ALTER TYPE "public"."player_transaction_type" ADD VALUE 'placed_on_ir';--> statement-breakpoint
ALTER TYPE "public"."player_transaction_type" ADD VALUE 'activated';--> statement-breakpoint
ALTER TYPE "public"."player_transaction_type" ADD VALUE 'suspended';--> statement-breakpoint
ALTER TYPE "public"."player_transaction_type" ADD VALUE 'retired';--> statement-breakpoint
ALTER TABLE "player_transactions" ADD COLUMN "trade_id" uuid;--> statement-breakpoint
ALTER TABLE "player_transactions" ADD COLUMN "counterparty_player_id" uuid;--> statement-breakpoint
ALTER TABLE "player_transactions" ADD CONSTRAINT "player_transactions_counterparty_player_id_players_id_fk" FOREIGN KEY ("counterparty_player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;