import { assertEquals } from "@std/assert";
import { DomainError } from "@zone-blitz/shared";
import { createHiringRouter, type HiringRouterDeps } from "./hiring.router.ts";
import type {
  HiringDecisionRow,
  HiringInterestRow,
  HiringInterviewRow,
  HiringOfferRow,
} from "./hiring.repository.ts";
import type { HiringService, TeamHiringState } from "./hiring.service.ts";

function makeInterest(
  overrides: Partial<HiringInterestRow> = {},
): HiringInterestRow {
  return {
    id: crypto.randomUUID(),
    leagueId: "lg",
    teamId: "tm",
    staffType: "coach",
    staffId: crypto.randomUUID(),
    stepSlug: "hiring_market_survey",
    status: "active",
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

function makeInterview(
  overrides: Partial<HiringInterviewRow> = {},
): HiringInterviewRow {
  return {
    id: crypto.randomUUID(),
    leagueId: "lg",
    teamId: "tm",
    staffType: "coach",
    staffId: crypto.randomUUID(),
    stepSlug: "hiring_interview_1",
    status: "requested",
    philosophyReveal: null,
    staffFitReveal: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

function makeOffer(overrides: Partial<HiringOfferRow> = {}): HiringOfferRow {
  return {
    id: crypto.randomUUID(),
    leagueId: "lg",
    teamId: "tm",
    staffType: "coach",
    staffId: crypto.randomUUID(),
    stepSlug: "hiring_offers",
    status: "pending",
    salary: 2_000_000,
    contractYears: 3,
    buyoutMultiplier: "0.50",
    incentives: [],
    preferenceScore: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

function makeDecision(
  overrides: Partial<HiringDecisionRow> = {},
): HiringDecisionRow {
  return {
    id: crypto.randomUUID(),
    leagueId: "lg",
    staffType: "coach",
    staffId: crypto.randomUUID(),
    chosenOfferId: null,
    wave: 1,
    decidedAt: new Date(0),
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

function makeTeamState(
  overrides: Partial<TeamHiringState> = {},
): TeamHiringState {
  return {
    leagueId: "lg",
    teamId: "tm",
    staffBudget: 50_000_000,
    remainingBudget: 25_000_000,
    interests: [],
    interviews: [],
    offers: [],
    decisions: [],
    ...overrides,
  };
}

function createMockService(
  overrides: Partial<HiringService> = {},
): HiringService {
  return {
    openMarket: () => Promise.resolve(),
    expressInterest: () => Promise.resolve(makeInterest()),
    requestInterviews: () => Promise.resolve([]),
    resolveInterviewDeclines: () => Promise.resolve([]),
    submitOffers: () => Promise.resolve([]),
    resolveDecisions: () => Promise.resolve([]),
    finalize: () => Promise.resolve({ decisions: [] }),
    getHiringState: () =>
      Promise.resolve({
        leagueId: "lg",
        interests: [],
        interviews: [],
        offers: [],
        decisions: [],
        unassignedCoaches: [],
        unassignedScouts: [],
      }),
    getTeamHiringState: () => Promise.resolve(makeTeamState()),
    listCandidates: () => Promise.resolve([]),
    getCandidateDetail: () => Promise.resolve(undefined),
    resolveCandidate: () => Promise.resolve(undefined),
    listDecisions: () => Promise.resolve([]),
    ...overrides,
  };
}

function createMockDeps(
  overrides: Partial<HiringRouterDeps> = {},
): HiringRouterDeps {
  return {
    leagueRepo: {
      getById: () =>
        Promise.resolve({
          id: "lg",
          numberOfTeams: 4,
          staffBudget: 50_000_000,
          interestCap: 10,
          interviewsPerWeek: 4,
          maxConcurrentOffers: 5,
          userTeamId: "tm",
        }),
    },
    leagueClockService: {
      getClockState: () =>
        Promise.resolve({
          leagueId: "lg",
          seasonYear: 2026,
          phase: "coaching_carousel",
          stepIndex: 0,
          slug: "hiring_market_survey",
          kind: "event",
          flavorDate: null,
          advancedAt: new Date(0),
          hasCompletedInitial: true,
        }),
    },
    ...overrides,
  };
}

Deno.test("GET /:leagueId/hiring/candidates returns candidate summaries", async () => {
  const router = createHiringRouter(
    createMockService({
      listCandidates: () =>
        Promise.resolve([
          {
            id: "c-1",
            leagueId: "lg",
            staffType: "coach",
            firstName: "Test",
            lastName: "One",
            role: "HC",
          },
          {
            id: "s-1",
            leagueId: "lg",
            staffType: "scout",
            firstName: "Test",
            lastName: "Two",
            role: "DIRECTOR",
          },
        ]),
    }),
    createMockDeps(),
  );

  const res = await router.request("/lg/hiring/candidates");
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.length, 2);
});

Deno.test("GET /:leagueId/hiring/candidates passes filter to service", async () => {
  let receivedFilter: unknown;
  const router = createHiringRouter(
    createMockService({
      listCandidates: (_l, filter) => {
        receivedFilter = filter;
        return Promise.resolve([]);
      },
    }),
    createMockDeps(),
  );

  const res = await router.request(
    "/lg/hiring/candidates?role=HC&staffType=coach",
  );
  assertEquals(res.status, 200);
  const filter = receivedFilter as Record<string, unknown>;
  assertEquals(filter.role, "HC");
  assertEquals(filter.staffType, "coach");
});

Deno.test("GET /:leagueId/hiring/candidates rejects invalid staffType", async () => {
  const router = createHiringRouter(createMockService(), createMockDeps());
  const res = await router.request(
    "/lg/hiring/candidates?staffType=groundskeeper",
  );
  assertEquals(res.status, 400);
});

Deno.test("GET /:leagueId/hiring/candidates/:candidateId returns detail with viewer team", async () => {
  let receivedViewer: string | undefined;
  const router = createHiringRouter(
    createMockService({
      getCandidateDetail: (_l, _id, viewerTeamId) => {
        receivedViewer = viewerTeamId;
        return Promise.resolve({
          id: "c-1",
          leagueId: "lg",
          staffType: "coach",
          firstName: "Test",
          lastName: "One",
          role: "HC",
          marketTierPref: 50,
          philosophyFitPref: 60,
          staffFitPref: 50,
          compensationPref: 50,
          minimumThreshold: 50,
          interviewReveal: null,
        });
      },
    }),
    createMockDeps(),
  );

  const res = await router.request("/lg/hiring/candidates/c-1");
  assertEquals(res.status, 200);
  assertEquals(receivedViewer, "tm");
  const body = await res.json();
  assertEquals(body.id, "c-1");
});

Deno.test("GET /:leagueId/hiring/candidates/:candidateId returns 404 when not found", async () => {
  const router = createHiringRouter(createMockService(), createMockDeps());
  const res = await router.request("/lg/hiring/candidates/missing");
  assertEquals(res.status, 404);
});

Deno.test("GET /:leagueId/hiring/state returns team state with remaining budget", async () => {
  const state = makeTeamState({ remainingBudget: 42_000_000 });
  const router = createHiringRouter(
    createMockService({ getTeamHiringState: () => Promise.resolve(state) }),
    createMockDeps(),
  );

  const res = await router.request("/lg/hiring/state");
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.remainingBudget, 42_000_000);
  assertEquals(body.teamId, "tm");
});

Deno.test("GET /:leagueId/hiring/state returns 400 when league has no user team", async () => {
  const router = createHiringRouter(
    createMockService(),
    createMockDeps({
      leagueRepo: {
        getById: () =>
          Promise.resolve({
            id: "lg",
            numberOfTeams: 4,
            staffBudget: 50_000_000,
            interestCap: 10,
            interviewsPerWeek: 4,
            maxConcurrentOffers: 5,
            userTeamId: null,
          }),
      },
    }),
  );
  const res = await router.request("/lg/hiring/state");
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "FORBIDDEN");
});

Deno.test("POST /:leagueId/hiring/interests resolves candidates and calls service per candidate", async () => {
  const candidateA = crypto.randomUUID();
  const candidateB = crypto.randomUUID();
  const resolveCalls: string[] = [];
  const expressCalls: Array<
    { staffType: string; staffId: string; stepSlug: string; teamId: string }
  > = [];
  const router = createHiringRouter(
    createMockService({
      resolveCandidate: (_l, id) => {
        resolveCalls.push(id);
        return Promise.resolve({
          staffType: id === candidateA ? "coach" : "scout",
          staffId: id,
        });
      },
      expressInterest: (input) => {
        expressCalls.push({
          staffType: input.staffType,
          staffId: input.staffId,
          stepSlug: input.stepSlug,
          teamId: input.teamId,
        });
        return Promise.resolve(
          makeInterest({ staffType: input.staffType, staffId: input.staffId }),
        );
      },
    }),
    createMockDeps(),
  );

  const res = await router.request("/lg/hiring/interests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateIds: [candidateA, candidateB] }),
  });

  assertEquals(res.status, 201);
  assertEquals(resolveCalls, [candidateA, candidateB]);
  assertEquals(expressCalls.length, 2);
  assertEquals(expressCalls[0].teamId, "tm");
  assertEquals(expressCalls[0].stepSlug, "hiring_market_survey");
  assertEquals(expressCalls[0].staffType, "coach");
  assertEquals(expressCalls[1].staffType, "scout");
});

Deno.test("POST /:leagueId/hiring/interests returns 400 when candidate is unknown", async () => {
  const router = createHiringRouter(
    createMockService({
      resolveCandidate: () => Promise.resolve(undefined),
    }),
    createMockDeps(),
  );

  const res = await router.request("/lg/hiring/interests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateIds: [crypto.randomUUID()] }),
  });

  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "INVALID_CANDIDATE");
});

Deno.test("POST /:leagueId/hiring/interests returns 400 when the current step is not a hiring step", async () => {
  const router = createHiringRouter(
    createMockService(),
    createMockDeps({
      leagueClockService: {
        getClockState: () =>
          Promise.resolve({
            leagueId: "lg",
            seasonYear: 2026,
            phase: "regular_season",
            stepIndex: 3,
            slug: "week_4",
            kind: "week",
            flavorDate: "Oct 1",
            advancedAt: new Date(0),
            hasCompletedInitial: true,
          }),
      },
    }),
  );

  const res = await router.request("/lg/hiring/interests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateIds: [crypto.randomUUID()] }),
  });

  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "INVALID_STEP");
});

Deno.test("POST /:leagueId/hiring/interests propagates INTEREST_CAP_EXCEEDED from service", async () => {
  const router = createHiringRouter(
    createMockService({
      resolveCandidate: (_l, id) =>
        Promise.resolve({ staffType: "coach", staffId: id }),
      expressInterest: () => {
        throw new DomainError("INTEREST_CAP_EXCEEDED", "cap");
      },
    }),
    createMockDeps(),
  );

  const res = await router.request("/lg/hiring/interests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateIds: [crypto.randomUUID()] }),
  });

  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "INTEREST_CAP_EXCEEDED");
});

Deno.test("POST /:leagueId/hiring/interests rejects invalid body", async () => {
  const router = createHiringRouter(createMockService(), createMockDeps());

  const res = await router.request("/lg/hiring/interests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateIds: [] }),
  });
  assertEquals(res.status, 400);
});

Deno.test("POST /:leagueId/hiring/interviews resolves candidates into targets", async () => {
  const candidateA = crypto.randomUUID();
  let receivedTargets: unknown;
  const router = createHiringRouter(
    createMockService({
      resolveCandidate: (_l, id) =>
        Promise.resolve({ staffType: "coach", staffId: id }),
      requestInterviews: (input) => {
        receivedTargets = input.targets;
        return Promise.resolve([makeInterview({ staffId: candidateA })]);
      },
    }),
    createMockDeps({
      leagueClockService: {
        getClockState: () =>
          Promise.resolve({
            leagueId: "lg",
            seasonYear: 2026,
            phase: "coaching_carousel",
            stepIndex: 1,
            slug: "hiring_interview_1",
            kind: "event",
            flavorDate: null,
            advancedAt: new Date(0),
            hasCompletedInitial: true,
          }),
      },
    }),
  );

  const res = await router.request("/lg/hiring/interviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateIds: [candidateA] }),
  });

  assertEquals(res.status, 201);
  const targets = receivedTargets as Array<Record<string, unknown>>;
  assertEquals(targets.length, 1);
  assertEquals(targets[0].staffType, "coach");
  assertEquals(targets[0].staffId, candidateA);
});

Deno.test("POST /:leagueId/hiring/offers builds draft offers with resolved staff types", async () => {
  const candidateId = crypto.randomUUID();
  let receivedOffers: unknown;
  const router = createHiringRouter(
    createMockService({
      resolveCandidate: () =>
        Promise.resolve({ staffType: "coach", staffId: candidateId }),
      submitOffers: (input) => {
        receivedOffers = input.offers;
        return Promise.resolve([makeOffer({ staffId: candidateId })]);
      },
    }),
    createMockDeps({
      leagueClockService: {
        getClockState: () =>
          Promise.resolve({
            leagueId: "lg",
            seasonYear: 2026,
            phase: "coaching_carousel",
            stepIndex: 3,
            slug: "hiring_offers",
            kind: "event",
            flavorDate: null,
            advancedAt: new Date(0),
            hasCompletedInitial: true,
          }),
      },
    }),
  );

  const res = await router.request("/lg/hiring/offers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      offers: [
        {
          candidateId,
          salary: 2_000_000,
          contractYears: 3,
          buyoutMultiplier: "0.75",
          incentives: [{ type: "playoff", value: 250_000 }],
        },
      ],
    }),
  });

  assertEquals(res.status, 201);
  const offers = receivedOffers as Array<Record<string, unknown>>;
  assertEquals(offers.length, 1);
  assertEquals(offers[0].staffType, "coach");
  assertEquals(offers[0].staffId, candidateId);
  assertEquals(offers[0].salary, 2_000_000);
  assertEquals(offers[0].buyoutMultiplier, "0.75");
});

Deno.test("POST /:leagueId/hiring/offers rejects malformed buyoutMultiplier", async () => {
  const router = createHiringRouter(createMockService(), createMockDeps());
  const res = await router.request("/lg/hiring/offers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      offers: [
        {
          candidateId: crypto.randomUUID(),
          salary: 1_000_000,
          contractYears: 2,
          buyoutMultiplier: "not-a-number",
        },
      ],
    }),
  });
  assertEquals(res.status, 400);
});

Deno.test("GET /:leagueId/hiring/decisions returns all decisions when no wave given", async () => {
  let receivedWave: number | undefined;
  const router = createHiringRouter(
    createMockService({
      listDecisions: (_l, wave) => {
        receivedWave = wave;
        return Promise.resolve([makeDecision({ wave: 1 })]);
      },
    }),
    createMockDeps(),
  );

  const res = await router.request("/lg/hiring/decisions");
  assertEquals(res.status, 200);
  assertEquals(receivedWave, undefined);
  const body = await res.json();
  assertEquals(body.length, 1);
});

Deno.test("GET /:leagueId/hiring/decisions filters by wave query param", async () => {
  let receivedWave: number | undefined;
  const router = createHiringRouter(
    createMockService({
      listDecisions: (_l, wave) => {
        receivedWave = wave;
        return Promise.resolve([makeDecision({ wave: 2 })]);
      },
    }),
    createMockDeps(),
  );

  const res = await router.request("/lg/hiring/decisions?wave=2");
  assertEquals(res.status, 200);
  assertEquals(receivedWave, 2);
});
