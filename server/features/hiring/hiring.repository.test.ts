import { assertEquals, assertExists } from "@std/assert";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import pino from "pino";
import * as schema from "../../db/schema.ts";
import { coaches } from "../coaches/coach.schema.ts";
import { coachTendencies } from "../coaches/coach-tendencies.schema.ts";
import { scouts } from "../scouts/scout.schema.ts";
import { leagues } from "../league/league.schema.ts";
import { teams } from "../team/team.schema.ts";
import { franchises } from "../franchise/franchise.schema.ts";
import { cities } from "../cities/city.schema.ts";
import { states } from "../states/state.schema.ts";
import {
  hiringDecisions,
  hiringInterests,
  hiringInterviews,
  hiringOffers,
} from "./hiring.schema.ts";
import { createHiringRepository } from "./hiring.repository.ts";

function createTestDb() {
  const connectionString = Deno.env.get("DATABASE_URL");
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for integration tests");
  }
  const client = postgres(connectionString);
  const db = drizzle(client, { schema });
  return { db, client };
}

function createTestLogger() {
  return pino({ level: "silent" });
}

async function setupFixtures(db: ReturnType<typeof createTestDb>["db"]) {
  const [league] = await db
    .insert(leagues)
    .values({ name: `League ${crypto.randomUUID()}` })
    .returning();
  const [state] = await db
    .insert(states)
    .values({
      code: `hr-${crypto.randomUUID().slice(0, 8)}`,
      name: `TestState-${crypto.randomUUID()}`,
      region: "West",
    })
    .returning();
  const [city] = await db
    .insert(cities)
    .values({
      name: `TestCity-${crypto.randomUUID()}`,
      stateId: state.id,
    })
    .returning();
  const [franchise] = await db
    .insert(franchises)
    .values({
      name: "Test Franchise",
      cityId: city.id,
      abbreviation: crypto.randomUUID().replace(/-/g, "").slice(0, 8)
        .toUpperCase(),
      primaryColor: "#000000",
      secondaryColor: "#FFFFFF",
      accentColor: "#FF0000",
      conference: "AFC",
      division: "AFC East",
    })
    .returning();
  const [team] = await db
    .insert(teams)
    .values({
      leagueId: league.id,
      franchiseId: franchise.id,
      name: "Test Team",
      cityId: city.id,
      abbreviation: crypto.randomUUID().replace(/-/g, "").slice(0, 8)
        .toUpperCase(),
      primaryColor: "#000000",
      secondaryColor: "#FFFFFF",
      accentColor: "#FF0000",
      conference: "AFC",
      division: "AFC East",
    })
    .returning();
  return { league, team, state, city, franchise };
}

interface Ctx {
  db: ReturnType<typeof createTestDb>["db"];
  leagueIds: string[];
  teamIds: string[];
  franchiseIds: string[];
  cityIds: string[];
  stateIds: string[];
  coachIds: string[];
  scoutIds: string[];
  interestIds: string[];
  interviewIds: string[];
  offerIds: string[];
  decisionIds: string[];
}

function emptyCtx(db: ReturnType<typeof createTestDb>["db"]): Ctx {
  return {
    db,
    leagueIds: [],
    teamIds: [],
    franchiseIds: [],
    cityIds: [],
    stateIds: [],
    coachIds: [],
    scoutIds: [],
    interestIds: [],
    interviewIds: [],
    offerIds: [],
    decisionIds: [],
  };
}

async function cleanup(ctx: Ctx) {
  if (ctx.decisionIds.length > 0) {
    await ctx.db.delete(hiringDecisions).where(
      inArray(hiringDecisions.id, ctx.decisionIds),
    );
  }
  if (ctx.offerIds.length > 0) {
    await ctx.db.delete(hiringOffers).where(
      inArray(hiringOffers.id, ctx.offerIds),
    );
  }
  if (ctx.interviewIds.length > 0) {
    await ctx.db.delete(hiringInterviews).where(
      inArray(hiringInterviews.id, ctx.interviewIds),
    );
  }
  if (ctx.interestIds.length > 0) {
    await ctx.db.delete(hiringInterests).where(
      inArray(hiringInterests.id, ctx.interestIds),
    );
  }
  if (ctx.coachIds.length > 0) {
    await ctx.db.delete(coaches).where(inArray(coaches.id, ctx.coachIds));
  }
  if (ctx.scoutIds.length > 0) {
    await ctx.db.delete(scouts).where(inArray(scouts.id, ctx.scoutIds));
  }
  for (const id of ctx.teamIds) {
    await ctx.db.delete(teams).where(eq(teams.id, id));
  }
  for (const id of ctx.franchiseIds) {
    await ctx.db.delete(franchises).where(eq(franchises.id, id));
  }
  for (const id of ctx.cityIds) {
    await ctx.db.delete(cities).where(eq(cities.id, id));
  }
  for (const id of ctx.stateIds) {
    await ctx.db.delete(states).where(eq(states.id, id));
  }
  for (const id of ctx.leagueIds) {
    await ctx.db.delete(leagues).where(eq(leagues.id, id));
  }
}

Deno.test({
  name: "hiringRepository.createInterest: inserts row with active status",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    try {
      const { league, team } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);
      ctx.teamIds.push(team.id);

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const staffId = crypto.randomUUID();
      const row = await repo.createInterest({
        leagueId: league.id,
        teamId: team.id,
        staffType: "coach",
        staffId,
        stepSlug: "hiring_market_survey",
      });
      ctx.interestIds.push(row.id);

      assertEquals(row.leagueId, league.id);
      assertEquals(row.teamId, team.id);
      assertEquals(row.staffType, "coach");
      assertEquals(row.staffId, staffId);
      assertEquals(row.stepSlug, "hiring_market_survey");
      assertEquals(row.status, "active");
    } finally {
      await cleanup(ctx);
      await client.end();
    }
  },
});

Deno.test({
  name: "hiringRepository.updateInterestStatus: flips an interest to withdrawn",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    try {
      const { league, team } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);
      ctx.teamIds.push(team.id);

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const created = await repo.createInterest({
        leagueId: league.id,
        teamId: team.id,
        staffType: "scout",
        staffId: crypto.randomUUID(),
        stepSlug: "hiring_market_survey",
      });
      ctx.interestIds.push(created.id);

      const updated = await repo.updateInterestStatus(created.id, "withdrawn");
      assertEquals(updated.status, "withdrawn");
      assertEquals(updated.id, created.id);
    } finally {
      await cleanup(ctx);
      await client.end();
    }
  },
});

Deno.test({
  name: "hiringRepository.listInterestsByLeague: scopes to a single league",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    try {
      const a = await setupFixtures(db);
      const b = await setupFixtures(db);
      ctx.leagueIds.push(a.league.id, b.league.id);
      ctx.teamIds.push(a.team.id, b.team.id);
      ctx.franchiseIds.push(a.franchise.id, b.franchise.id);
      ctx.cityIds.push(a.city.id, b.city.id);
      ctx.stateIds.push(a.state.id, b.state.id);

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const one = await repo.createInterest({
        leagueId: a.league.id,
        teamId: a.team.id,
        staffType: "coach",
        staffId: crypto.randomUUID(),
        stepSlug: "hiring_market_survey",
      });
      const two = await repo.createInterest({
        leagueId: b.league.id,
        teamId: b.team.id,
        staffType: "coach",
        staffId: crypto.randomUUID(),
        stepSlug: "hiring_market_survey",
      });
      ctx.interestIds.push(one.id, two.id);

      const listA = await repo.listInterestsByLeague(a.league.id);
      assertEquals(listA.length, 1);
      assertEquals(listA[0].id, one.id);
    } finally {
      await cleanup(ctx);
      await client.end();
    }
  },
});

Deno.test({
  name: "hiringRepository.createInterview: defaults to requested status",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    try {
      const { league, team } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);
      ctx.teamIds.push(team.id);

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const row = await repo.createInterview({
        leagueId: league.id,
        teamId: team.id,
        staffType: "coach",
        staffId: crypto.randomUUID(),
        stepSlug: "hiring_interview_1",
      });
      ctx.interviewIds.push(row.id);

      assertEquals(row.status, "requested");
      assertEquals(row.philosophyReveal, null);
      assertEquals(row.staffFitReveal, null);
    } finally {
      await cleanup(ctx);
      await client.end();
    }
  },
});

Deno.test({
  name: "hiringRepository.updateInterview: patches status and reveal payloads",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    try {
      const { league, team } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);
      ctx.teamIds.push(team.id);

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const created = await repo.createInterview({
        leagueId: league.id,
        teamId: team.id,
        staffType: "scout",
        staffId: crypto.randomUUID(),
        stepSlug: "hiring_interview_1",
      });
      ctx.interviewIds.push(created.id);

      const updated = await repo.updateInterview(created.id, {
        status: "completed",
        philosophyReveal: { schemeFamily: "spread" },
        staffFitReveal: { hcAlignment: 0.8 },
      });
      assertEquals(updated.status, "completed");
      assertEquals(
        (updated.philosophyReveal as { schemeFamily: string }).schemeFamily,
        "spread",
      );
      assertEquals(
        (updated.staffFitReveal as { hcAlignment: number }).hcAlignment,
        0.8,
      );
    } finally {
      await cleanup(ctx);
      await client.end();
    }
  },
});

Deno.test({
  name:
    "hiringRepository.listInterviewsByLeague: returns only matching league rows",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    try {
      const a = await setupFixtures(db);
      const b = await setupFixtures(db);
      ctx.leagueIds.push(a.league.id, b.league.id);
      ctx.teamIds.push(a.team.id, b.team.id);
      ctx.franchiseIds.push(a.franchise.id, b.franchise.id);
      ctx.cityIds.push(a.city.id, b.city.id);
      ctx.stateIds.push(a.state.id, b.state.id);

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const one = await repo.createInterview({
        leagueId: a.league.id,
        teamId: a.team.id,
        staffType: "coach",
        staffId: crypto.randomUUID(),
        stepSlug: "hiring_interview_1",
      });
      const two = await repo.createInterview({
        leagueId: b.league.id,
        teamId: b.team.id,
        staffType: "coach",
        staffId: crypto.randomUUID(),
        stepSlug: "hiring_interview_1",
      });
      ctx.interviewIds.push(one.id, two.id);

      const listB = await repo.listInterviewsByLeague(b.league.id);
      assertEquals(listB.length, 1);
      assertEquals(listB[0].id, two.id);
    } finally {
      await cleanup(ctx);
      await client.end();
    }
  },
});

Deno.test({
  name: "hiringRepository.createOffer: stores numeric buyout multiplier",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    try {
      const { league, team } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);
      ctx.teamIds.push(team.id);

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const row = await repo.createOffer({
        leagueId: league.id,
        teamId: team.id,
        staffType: "coach",
        staffId: crypto.randomUUID(),
        stepSlug: "hiring_offers",
        salary: 5_000_000,
        contractYears: 3,
        buyoutMultiplier: "0.75",
        incentives: [{ kind: "playoff_appearance", amount: 500_000 }],
      });
      ctx.offerIds.push(row.id);

      assertEquals(row.status, "pending");
      assertEquals(row.salary, 5_000_000);
      assertEquals(row.contractYears, 3);
      assertEquals(row.buyoutMultiplier, "0.75");
      assertEquals(row.preferenceScore, null);
    } finally {
      await cleanup(ctx);
      await client.end();
    }
  },
});

Deno.test({
  name:
    "hiringRepository.updateOffer: patches status and preference score together",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    try {
      const { league, team } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);
      ctx.teamIds.push(team.id);

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const created = await repo.createOffer({
        leagueId: league.id,
        teamId: team.id,
        staffType: "coach",
        staffId: crypto.randomUUID(),
        stepSlug: "hiring_offers",
        salary: 3_000_000,
        contractYears: 2,
        buyoutMultiplier: "0.50",
      });
      ctx.offerIds.push(created.id);

      const updated = await repo.updateOffer(created.id, {
        status: "accepted",
        preferenceScore: 87,
      });
      assertEquals(updated.status, "accepted");
      assertEquals(updated.preferenceScore, 87);
    } finally {
      await cleanup(ctx);
      await client.end();
    }
  },
});

Deno.test({
  name: "hiringRepository.listOffersByLeague: scopes results to a league",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    try {
      const a = await setupFixtures(db);
      const b = await setupFixtures(db);
      ctx.leagueIds.push(a.league.id, b.league.id);
      ctx.teamIds.push(a.team.id, b.team.id);
      ctx.franchiseIds.push(a.franchise.id, b.franchise.id);
      ctx.cityIds.push(a.city.id, b.city.id);
      ctx.stateIds.push(a.state.id, b.state.id);

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const one = await repo.createOffer({
        leagueId: a.league.id,
        teamId: a.team.id,
        staffType: "coach",
        staffId: crypto.randomUUID(),
        stepSlug: "hiring_offers",
        salary: 1_500_000,
        contractYears: 2,
        buyoutMultiplier: "0.60",
      });
      const two = await repo.createOffer({
        leagueId: b.league.id,
        teamId: b.team.id,
        staffType: "coach",
        staffId: crypto.randomUUID(),
        stepSlug: "hiring_offers",
        salary: 2_500_000,
        contractYears: 3,
        buyoutMultiplier: "0.60",
      });
      ctx.offerIds.push(one.id, two.id);

      const listA = await repo.listOffersByLeague(a.league.id);
      assertEquals(listA.length, 1);
      assertEquals(listA[0].id, one.id);
    } finally {
      await cleanup(ctx);
      await client.end();
    }
  },
});

Deno.test({
  name:
    "hiringRepository.createDecision + listDecisionsByLeague: store and fetch",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    try {
      const { league, team } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);
      ctx.teamIds.push(team.id);

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const offer = await repo.createOffer({
        leagueId: league.id,
        teamId: team.id,
        staffType: "coach",
        staffId: crypto.randomUUID(),
        stepSlug: "hiring_offers",
        salary: 4_000_000,
        contractYears: 3,
        buyoutMultiplier: "0.75",
      });
      ctx.offerIds.push(offer.id);

      const decision = await repo.createDecision({
        leagueId: league.id,
        staffType: "coach",
        staffId: offer.staffId,
        chosenOfferId: offer.id,
        wave: 1,
      });
      ctx.decisionIds.push(decision.id);

      assertEquals(decision.wave, 1);
      assertEquals(decision.chosenOfferId, offer.id);

      const list = await repo.listDecisionsByLeague(league.id);
      assertEquals(list.length, 1);
      assertEquals(list[0].id, decision.id);
    } finally {
      await cleanup(ctx);
      await client.end();
    }
  },
});

Deno.test({
  name:
    "hiringRepository.createDecision: accepts null chosen offer for unsigned candidate",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    try {
      const { league } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const decision = await repo.createDecision({
        leagueId: league.id,
        staffType: "scout",
        staffId: crypto.randomUUID(),
        chosenOfferId: null,
        wave: 2,
      });
      ctx.decisionIds.push(decision.id);

      assertEquals(decision.chosenOfferId, null);
      assertEquals(decision.wave, 2);
    } finally {
      await cleanup(ctx);
      await client.end();
    }
  },
});

Deno.test({
  name:
    "hiringRepository.listUnassignedCoaches: returns only coaches with teamId null in the league",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    try {
      const { league, team } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);
      ctx.teamIds.push(team.id);

      const signedId = crypto.randomUUID();
      const poolId = crypto.randomUUID();
      await db.insert(coaches).values([
        {
          id: signedId,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Signed",
          lastName: "Coach",
          role: "HC",
          age: 50,
          hiredAt: new Date("2027-01-01T00:00:00Z"),
          contractYears: 3,
          contractSalary: 10_000_000,
          contractBuyout: 20_000_000,
        },
        {
          id: poolId,
          leagueId: league.id,
          teamId: null,
          firstName: "Pool",
          lastName: "Candidate",
          role: "OC",
          age: 42,
          hiredAt: new Date("2027-01-01T00:00:00Z"),
          contractYears: 0,
          contractSalary: 0,
          contractBuyout: 0,
          marketTierPref: 70,
          philosophyFitPref: 60,
          staffFitPref: 50,
          compensationPref: 40,
          minimumThreshold: 35,
        },
      ]);
      ctx.coachIds.push(signedId, poolId);

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const pool = await repo.listUnassignedCoaches(league.id);

      assertEquals(pool.length, 1);
      assertEquals(pool[0].id, poolId);
      assertEquals(pool[0].marketTierPref, 70);
      assertEquals(pool[0].minimumThreshold, 35);
    } finally {
      await cleanup(ctx);
      await client.end();
    }
  },
});

Deno.test({
  name:
    "hiringRepository.listUnassignedScouts: returns only scouts with teamId null in the league",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    try {
      const { league, team } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);
      ctx.teamIds.push(team.id);

      const signedId = crypto.randomUUID();
      const poolId = crypto.randomUUID();
      await db.insert(scouts).values([
        {
          id: signedId,
          leagueId: league.id,
          teamId: team.id,
          firstName: "Signed",
          lastName: "Scout",
          role: "DIRECTOR",
        },
        {
          id: poolId,
          leagueId: league.id,
          teamId: null,
          firstName: "Pool",
          lastName: "Scout",
          role: "AREA_SCOUT",
          marketTierPref: 40,
          minimumThreshold: 25,
        },
      ]);
      ctx.scoutIds.push(signedId, poolId);

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const pool = await repo.listUnassignedScouts(league.id);

      assertEquals(pool.length, 1);
      assertEquals(pool[0].id, poolId);
      assertEquals(pool[0].minimumThreshold, 25);
    } finally {
      await cleanup(ctx);
      await client.end();
    }
  },
});

Deno.test({
  name: "hiringRepository.getInterestById: returns undefined when missing",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    try {
      const repo = createHiringRepository({ db, log: createTestLogger() });
      const result = await repo.getInterestById(crypto.randomUUID());
      assertEquals(result, undefined);
    } finally {
      await client.end();
    }
  },
});

Deno.test({
  name: "hiringRepository.getInterestById: returns a stored row",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    try {
      const { league, team } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);
      ctx.teamIds.push(team.id);

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const created = await repo.createInterest({
        leagueId: league.id,
        teamId: team.id,
        staffType: "coach",
        staffId: crypto.randomUUID(),
        stepSlug: "hiring_market_survey",
      });
      ctx.interestIds.push(created.id);

      const fetched = await repo.getInterestById(created.id);
      assertExists(fetched);
      assertEquals(fetched?.id, created.id);
    } finally {
      await cleanup(ctx);
      await client.end();
    }
  },
});

Deno.test({
  name:
    "hiringRepository.getInterviewById / getOfferById: return undefined when missing",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    try {
      const repo = createHiringRepository({ db, log: createTestLogger() });
      assertEquals(
        await repo.getInterviewById(crypto.randomUUID()),
        undefined,
      );
      assertEquals(
        await repo.getOfferById(crypto.randomUUID()),
        undefined,
      );
    } finally {
      await client.end();
    }
  },
});

Deno.test({
  name:
    "hiringRepository.listInterestsByTeam + findActiveInterest: scope to team and respect status",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    try {
      const { league, team } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);
      ctx.teamIds.push(team.id);

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const candidate = crypto.randomUUID();
      const active = await repo.createInterest({
        leagueId: league.id,
        teamId: team.id,
        staffType: "coach",
        staffId: candidate,
        stepSlug: "hiring_market_survey",
      });
      const withdrawn = await repo.createInterest({
        leagueId: league.id,
        teamId: team.id,
        staffType: "scout",
        staffId: crypto.randomUUID(),
        stepSlug: "hiring_market_survey",
      });
      await repo.updateInterestStatus(withdrawn.id, "withdrawn");
      ctx.interestIds.push(active.id, withdrawn.id);

      const teamInterests = await repo.listInterestsByTeam(
        league.id,
        team.id,
      );
      assertEquals(teamInterests.length, 2);

      const found = await repo.findActiveInterest(
        league.id,
        team.id,
        "coach",
        candidate,
      );
      assertExists(found);

      const withdrawnSearch = await repo.findActiveInterest(
        league.id,
        team.id,
        "scout",
        withdrawn.staffId,
      );
      assertEquals(withdrawnSearch, undefined);
    } finally {
      await cleanup(ctx);
      await client.end();
    }
  },
});

Deno.test({
  name:
    "hiringRepository.listInterviewsByTeam / Step + findInterview: scope correctly",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    try {
      const { league, team } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);
      ctx.teamIds.push(team.id);

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const candidateA = crypto.randomUUID();
      const candidateB = crypto.randomUUID();
      const week1 = await repo.createInterview({
        leagueId: league.id,
        teamId: team.id,
        staffType: "coach",
        staffId: candidateA,
        stepSlug: "hiring_interview_1",
      });
      const week2 = await repo.createInterview({
        leagueId: league.id,
        teamId: team.id,
        staffType: "scout",
        staffId: candidateB,
        stepSlug: "hiring_interview_2",
      });
      ctx.interviewIds.push(week1.id, week2.id);

      const teamRows = await repo.listInterviewsByTeam(league.id, team.id);
      assertEquals(teamRows.length, 2);

      const stepRows = await repo.listInterviewsByStep(
        league.id,
        "hiring_interview_2",
      );
      assertEquals(stepRows.length, 1);
      assertEquals(stepRows[0].id, week2.id);

      const matched = await repo.findInterview(
        league.id,
        team.id,
        "coach",
        candidateA,
      );
      assertExists(matched);

      const unmatched = await repo.findInterview(
        league.id,
        team.id,
        "coach",
        crypto.randomUUID(),
      );
      assertEquals(unmatched, undefined);
    } finally {
      await cleanup(ctx);
      await client.end();
    }
  },
});

Deno.test({
  name:
    "hiringRepository.listOffersByTeam + listPendingOffersByLeague: filter by team and status",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    try {
      const { league, team } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);
      ctx.teamIds.push(team.id);

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const pending = await repo.createOffer({
        leagueId: league.id,
        teamId: team.id,
        staffType: "coach",
        staffId: crypto.randomUUID(),
        stepSlug: "hiring_offers",
        salary: 1_000_000,
        contractYears: 2,
        buyoutMultiplier: "0.50",
      });
      const accepted = await repo.createOffer({
        leagueId: league.id,
        teamId: team.id,
        staffType: "scout",
        staffId: crypto.randomUUID(),
        stepSlug: "hiring_offers",
        salary: 200_000,
        contractYears: 2,
        buyoutMultiplier: "0.50",
      });
      await repo.updateOffer(accepted.id, { status: "accepted" });
      ctx.offerIds.push(pending.id, accepted.id);

      const teamOffers = await repo.listOffersByTeam(league.id, team.id);
      assertEquals(teamOffers.length, 2);

      const pendingOffers = await repo.listPendingOffersByLeague(league.id);
      assertEquals(pendingOffers.length, 1);
      assertEquals(pendingOffers[0].id, pending.id);
    } finally {
      await cleanup(ctx);
      await client.end();
    }
  },
});

Deno.test({
  name:
    "hiringRepository.getCandidateScoringContext: returns coach preferences and tendencies",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    const coachId = crypto.randomUUID();
    try {
      const { league } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);

      await db.insert(coaches).values({
        id: coachId,
        leagueId: league.id,
        teamId: null,
        firstName: "Pool",
        lastName: "Coach",
        role: "OC",
        age: 45,
        hiredAt: new Date("2027-01-01T00:00:00Z"),
        contractYears: 0,
        contractSalary: 0,
        contractBuyout: 0,
        marketTierPref: 70,
        philosophyFitPref: 60,
        staffFitPref: 55,
        compensationPref: 80,
        minimumThreshold: 40,
      });
      ctx.coachIds.push(coachId);

      await db.insert(coachTendencies).values({
        coachId,
        runPassLean: 60,
        tempo: 70,
        personnelWeight: 50,
        formationUnderCenterShotgun: 40,
        preSnapMotionRate: 45,
        passingStyle: 50,
        passingDepth: 55,
        runGameBlocking: 50,
        rpoIntegration: 30,
      });

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const ctxOut = await repo.getCandidateScoringContext("coach", coachId);
      assertExists(ctxOut);
      assertEquals(ctxOut?.role, "OC");
      assertEquals(ctxOut?.preferences.marketTierPref, 70);
      assertExists(ctxOut?.offense);
      assertEquals(ctxOut?.defense, null);

      assertEquals(
        await repo.getCandidateScoringContext("coach", crypto.randomUUID()),
        undefined,
      );
    } finally {
      await db.delete(coachTendencies).where(
        eq(coachTendencies.coachId, coachId),
      );
      await cleanup(ctx);
      await client.end();
    }
  },
});

Deno.test({
  name:
    "hiringRepository.getCandidateScoringContext: returns scout preferences with no tendencies",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    try {
      const { league } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);

      const scoutId = crypto.randomUUID();
      await db.insert(scouts).values({
        id: scoutId,
        leagueId: league.id,
        teamId: null,
        firstName: "Pool",
        lastName: "Scout",
        role: "AREA_SCOUT",
        marketTierPref: 30,
        philosophyFitPref: 40,
        staffFitPref: 50,
        compensationPref: 60,
        minimumThreshold: 20,
      });
      ctx.scoutIds.push(scoutId);

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const result = await repo.getCandidateScoringContext("scout", scoutId);
      assertExists(result);
      assertEquals(result?.staffType, "scout");
      assertEquals(result?.preferences.minimumThreshold, 20);
      assertEquals(result?.offense, null);
      assertEquals(result?.defense, null);

      assertEquals(
        await repo.getCandidateScoringContext("scout", crypto.randomUUID()),
        undefined,
      );
    } finally {
      await cleanup(ctx);
      await client.end();
    }
  },
});

Deno.test({
  name:
    "hiringRepository.getFranchiseScoringProfile: derives market tier and existing staff",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    const coachId = crypto.randomUUID();
    try {
      const { league, team } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);
      ctx.teamIds.push(team.id);

      await db.insert(coaches).values({
        id: coachId,
        leagueId: league.id,
        teamId: team.id,
        firstName: "Existing",
        lastName: "OC",
        role: "OC",
        age: 45,
        hiredAt: new Date("2027-01-01T00:00:00Z"),
        contractYears: 3,
        contractSalary: 4_000_000,
        contractBuyout: 6_000_000,
      });
      ctx.coachIds.push(coachId);

      await db.insert(coachTendencies).values({
        coachId,
        runPassLean: 50,
        tempo: 50,
        personnelWeight: 50,
        formationUnderCenterShotgun: 50,
        preSnapMotionRate: 50,
        passingStyle: 50,
        passingDepth: 50,
        runGameBlocking: 50,
        rpoIntegration: 50,
      });

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const profile = await repo.getFranchiseScoringProfile(team.id);
      assertExists(profile);
      assertEquals(profile?.teamId, team.id);
      // Test fixture cities are random — neither Large nor Medium tier — so
      // the profile resolves to the small-market default.
      assertEquals(profile?.marketTier, "small");
      assertEquals(profile?.existingStaff.length, 1);
      assertEquals(profile?.existingStaff[0].role, "OC");

      assertEquals(
        await repo.getFranchiseScoringProfile(crypto.randomUUID()),
        undefined,
      );
    } finally {
      await db.delete(coachTendencies).where(
        eq(coachTendencies.coachId, coachId),
      );
      await cleanup(ctx);
      await client.end();
    }
  },
});

Deno.test({
  name:
    "hiringRepository.sumSignedStaffSalaries: aggregates coach + scout salaries",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    try {
      const { league, team } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);
      ctx.teamIds.push(team.id);

      const coachId = crypto.randomUUID();
      const scoutId = crypto.randomUUID();
      await db.insert(coaches).values({
        id: coachId,
        leagueId: league.id,
        teamId: team.id,
        firstName: "Signed",
        lastName: "Coach",
        role: "HC",
        age: 50,
        hiredAt: new Date("2027-01-01T00:00:00Z"),
        contractYears: 4,
        contractSalary: 8_000_000,
        contractBuyout: 16_000_000,
      });
      await db.insert(scouts).values({
        id: scoutId,
        leagueId: league.id,
        teamId: team.id,
        firstName: "Signed",
        lastName: "Scout",
        role: "DIRECTOR",
        contractSalary: 500_000,
      });
      ctx.coachIds.push(coachId);
      ctx.scoutIds.push(scoutId);

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const total = await repo.sumSignedStaffSalaries(team.id);
      assertEquals(total, 8_500_000);

      const empty = await repo.sumSignedStaffSalaries(crypto.randomUUID());
      assertEquals(empty, 0);
    } finally {
      await cleanup(ctx);
      await client.end();
    }
  },
});

Deno.test({
  name:
    "hiringRepository.listTeamsForLeague + listSignedStaffByTeam: enumerate teams and signed staff",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    try {
      const { league, team } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);
      ctx.teamIds.push(team.id);

      const coachId = crypto.randomUUID();
      const scoutId = crypto.randomUUID();
      await db.insert(coaches).values({
        id: coachId,
        leagueId: league.id,
        teamId: team.id,
        firstName: "Signed",
        lastName: "Coach",
        role: "HC",
        age: 50,
        hiredAt: new Date("2027-01-01T00:00:00Z"),
        contractYears: 3,
        contractSalary: 6_000_000,
        contractBuyout: 12_000_000,
      });
      await db.insert(scouts).values({
        id: scoutId,
        leagueId: league.id,
        teamId: team.id,
        firstName: "Signed",
        lastName: "Scout",
        role: "DIRECTOR",
        contractSalary: 400_000,
      });
      ctx.coachIds.push(coachId);
      ctx.scoutIds.push(scoutId);

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const teamsList = await repo.listTeamsForLeague(league.id);
      assertEquals(teamsList.length, 1);
      assertEquals(teamsList[0].teamId, team.id);

      const signed = await repo.listSignedStaffByTeam(league.id, team.id);
      assertEquals(signed.length, 2);
      const coachEntry = signed.find((m) => m.staffType === "coach");
      const scoutEntry = signed.find((m) => m.staffType === "scout");
      assertEquals(coachEntry?.role, "HC");
      assertEquals(scoutEntry?.role, "DIRECTOR");
    } finally {
      await cleanup(ctx);
      await client.end();
    }
  },
});

Deno.test({
  name: "hiringRepository.assignCoach: writes hire fields onto the coach row",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    try {
      const { league, team } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);
      ctx.teamIds.push(team.id);

      const coachId = crypto.randomUUID();
      await db.insert(coaches).values({
        id: coachId,
        leagueId: league.id,
        teamId: null,
        firstName: "Pool",
        lastName: "Coach",
        role: "OC",
        age: 42,
        hiredAt: new Date("2024-01-01T00:00:00Z"),
        contractYears: 0,
        contractSalary: 0,
        contractBuyout: 0,
      });
      ctx.coachIds.push(coachId);

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const hiredAt = new Date("2027-04-16T00:00:00Z");
      await repo.assignCoach(coachId, {
        teamId: team.id,
        reportsToId: null,
        contractSalary: 3_000_000,
        contractYears: 3,
        contractBuyout: 4_500_000,
        hiredAt,
      });

      const [row] = await db
        .select()
        .from(coaches)
        .where(eq(coaches.id, coachId))
        .limit(1);
      assertEquals(row.teamId, team.id);
      assertEquals(row.contractSalary, 3_000_000);
      assertEquals(row.contractYears, 3);
      assertEquals(row.contractBuyout, 4_500_000);
      assertEquals(row.hiredAt.toISOString(), hiredAt.toISOString());
    } finally {
      await cleanup(ctx);
      await client.end();
    }
  },
});

Deno.test({
  name: "hiringRepository.assignScout: writes hire fields onto the scout row",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { db, client } = createTestDb();
    const ctx = emptyCtx(db);
    try {
      const { league, team } = await setupFixtures(db);
      ctx.leagueIds.push(league.id);
      ctx.teamIds.push(team.id);

      const scoutId = crypto.randomUUID();
      await db.insert(scouts).values({
        id: scoutId,
        leagueId: league.id,
        teamId: null,
        firstName: "Pool",
        lastName: "Scout",
        role: "AREA_SCOUT",
      });
      ctx.scoutIds.push(scoutId);

      const repo = createHiringRepository({ db, log: createTestLogger() });
      const hiredAt = new Date("2027-04-16T00:00:00Z");
      await repo.assignScout(scoutId, {
        teamId: team.id,
        contractSalary: 150_000,
        contractYears: 2,
        contractBuyout: 150_000,
        hiredAt,
      });

      const [row] = await db
        .select()
        .from(scouts)
        .where(eq(scouts.id, scoutId))
        .limit(1);
      assertEquals(row.teamId, team.id);
      assertEquals(row.contractSalary, 150_000);
      assertEquals(row.contractYears, 2);
      assertEquals(row.hiredAt.toISOString(), hiredAt.toISOString());
    } finally {
      await cleanup(ctx);
      await client.end();
    }
  },
});
