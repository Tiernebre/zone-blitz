/**
 * Emits the SQL for migration 0010_states_cities_refactor.sql to stdout.
 *
 * Run: deno run --allow-read bin/generate-states-cities-migration.ts > server/db/migrations/0010_states_cities_refactor.sql
 *
 * The migration is data-preserving for `colleges` (backfills city_id from
 * existing city + state text before dropping those columns). It is destructive
 * for `teams` and their FK dependents (coaches, players, scouts, front-office
 * staff, contracts, games), since the pre-existing teams.city text lacks a
 * state qualifier and cannot be unambiguously resolved to a city_id.
 */
import { DEFAULT_STATES } from "../server/features/states/default-states.ts";
import { DEFAULT_CITIES } from "../server/features/cities/default-cities.ts";

function sqlString(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

const statesValues = DEFAULT_STATES.map((s) =>
  `(${sqlString(s.code)}, ${sqlString(s.name)}, ${sqlString(s.region)})`
).join(",\n  ");

const cityValuesRows = DEFAULT_CITIES.map((c) =>
  `(${sqlString(c.name)}, ${sqlString(c.stateCode)})`
).join(",\n  ");

const sql = `CREATE TABLE "states" (
\t"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
\t"code" text NOT NULL,
\t"name" text NOT NULL,
\t"region" text NOT NULL,
\t"created_at" timestamp DEFAULT now() NOT NULL,
\t"updated_at" timestamp DEFAULT now() NOT NULL,
\tCONSTRAINT "states_code_unique" UNIQUE("code"),
\tCONSTRAINT "states_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "cities" (
\t"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
\t"name" text NOT NULL,
\t"state_id" uuid NOT NULL,
\t"created_at" timestamp DEFAULT now() NOT NULL,
\t"updated_at" timestamp DEFAULT now() NOT NULL,
\tCONSTRAINT "cities_name_state_id_unique" UNIQUE("name","state_id")
);
--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_state_id_states_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."states"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "states" ("code", "name", "region") VALUES
  ${statesValues};
--> statement-breakpoint
INSERT INTO "cities" ("name", "state_id")
SELECT v.name, s.id
FROM (VALUES
  ${cityValuesRows}
) AS v(name, code)
INNER JOIN "states" s ON s.code = v.code;
--> statement-breakpoint
ALTER TABLE "colleges" ADD COLUMN "city_id" uuid;
--> statement-breakpoint
UPDATE "colleges" c SET "city_id" = (
  SELECT ci.id FROM "cities" ci
  INNER JOIN "states" s ON ci.state_id = s.id
  WHERE ci.name = c.city AND s.code = c.state
);
--> statement-breakpoint
ALTER TABLE "colleges" ALTER COLUMN "city_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "colleges" ADD CONSTRAINT "colleges_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "colleges" DROP COLUMN "city";
--> statement-breakpoint
ALTER TABLE "colleges" DROP COLUMN "state";
--> statement-breakpoint
-- teams.city lacks state qualifier and cannot be unambiguously backfilled;
-- truncate teams (and FK-dependent rows) so we can re-seed them cleanly.
TRUNCATE "teams" RESTART IDENTITY CASCADE;
--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "city";
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "city_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;
`;

console.log(sql);
