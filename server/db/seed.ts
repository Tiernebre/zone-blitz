import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import pino from "pino";
import { cities, colleges, leaguePhaseStep, states } from "./schema.ts";
import { DEFAULT_STATES } from "../features/states/default-states.ts";
import { DEFAULT_CITIES } from "../features/cities/default-cities.ts";
import { DEFAULT_COLLEGES } from "../features/colleges/default-colleges.ts";
import { DEFAULT_PHASE_STEPS } from "../features/league-clock/default-phase-steps.ts";

const log = pino({
  transport: { target: "pino-pretty" },
});

const databaseUrl = Deno.env.get("DATABASE_URL");
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(databaseUrl, {
  max: 1,
  onnotice: () => {},
});
const db = drizzle(client);

log.info("Seeding default states...");
await db
  .insert(states)
  .values(DEFAULT_STATES)
  .onConflictDoNothing({ target: states.code });
log.info({ count: DEFAULT_STATES.length }, "Default states seeded.");

const stateRows = await db.select({ id: states.id, code: states.code }).from(
  states,
);
const stateIdByCode = new Map(stateRows.map((s) => [s.code, s.id]));

log.info("Seeding default cities...");
await db
  .insert(cities)
  .values(
    DEFAULT_CITIES.map((c) => {
      const stateId = stateIdByCode.get(c.stateCode);
      if (!stateId) {
        throw new Error(
          `City ${c.name} references unknown state ${c.stateCode}`,
        );
      }
      return { name: c.name, stateId };
    }),
  )
  .onConflictDoNothing({
    target: [cities.name, cities.stateId],
  });
log.info({ count: DEFAULT_CITIES.length }, "Default cities seeded.");

const cityRows = await db.select({
  id: cities.id,
  name: cities.name,
  stateId: cities.stateId,
}).from(cities);
const stateCodeById = new Map(stateRows.map((s) => [s.id, s.code]));
const cityIdByKey = new Map(
  cityRows.map((c) => [`${c.name}|${stateCodeById.get(c.stateId)}`, c.id]),
);

function resolveCityId(name: string, stateCode: string): string {
  const id = cityIdByKey.get(`${name}|${stateCode}`);
  if (!id) {
    throw new Error(`Unknown city ${name}, ${stateCode} in seed data`);
  }
  return id;
}

log.info("Seeding default colleges...");
await db
  .insert(colleges)
  .values(
    DEFAULT_COLLEGES.map((c) => ({
      name: c.name,
      shortName: c.shortName,
      nickname: c.nickname,
      cityId: resolveCityId(c.city, c.state),
      conference: c.conference,
      subdivision: c.subdivision,
    })),
  )
  .onConflictDoUpdate({
    target: colleges.name,
    set: {
      cityId: sql`excluded.city_id`,
      updatedAt: new Date(),
    },
  });
log.info({ count: DEFAULT_COLLEGES.length }, "Default colleges seeded.");

log.info("Seeding league phase steps...");
await db
  .insert(leaguePhaseStep)
  .values(
    DEFAULT_PHASE_STEPS.map((s) => ({
      phase: s.phase,
      stepIndex: s.stepIndex,
      slug: s.slug,
      kind: s.kind,
      flavorDate: s.flavorDate ?? null,
    })),
  )
  .onConflictDoNothing();
log.info({ count: DEFAULT_PHASE_STEPS.length }, "League phase steps seeded.");

await client.end();
