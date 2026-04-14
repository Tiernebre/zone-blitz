import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import pino from "pino";
import { cities, colleges, states, teams } from "./schema.ts";
import { DEFAULT_STATES } from "../features/states/default-states.ts";
import { DEFAULT_CITIES } from "../features/cities/default-cities.ts";
import { DEFAULT_TEAMS } from "../features/team/default-teams.ts";
import { DEFAULT_COLLEGES } from "../features/colleges/default-colleges.ts";

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

log.info("Seeding default teams...");
await db
  .insert(teams)
  .values(
    DEFAULT_TEAMS.map((t) => ({
      name: t.name,
      cityId: resolveCityId(t.city, t.state),
      abbreviation: t.abbreviation,
      primaryColor: t.primaryColor,
      secondaryColor: t.secondaryColor,
      accentColor: t.accentColor,
      conference: t.conference,
      division: t.division,
    })),
  )
  .onConflictDoUpdate({
    target: teams.abbreviation,
    set: {
      cityId: sql`excluded.city_id`,
      updatedAt: new Date(),
    },
  });
log.info({ count: DEFAULT_TEAMS.length }, "Default teams seeded.");

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

await client.end();
