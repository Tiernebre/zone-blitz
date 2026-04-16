import { assertEquals, assertRejects } from "@std/assert";
import { DomainError } from "@zone-blitz/shared";
import pino from "pino";
import type {
  HiringDecisionRow,
  HiringInterestRow,
  HiringInterviewRow,
  HiringOfferRow,
  HiringRepository,
  UnassignedCandidate,
} from "./hiring.repository.ts";
import { createHiringService } from "./hiring.service.ts";

function stubRepo(
  overrides: Partial<HiringRepository> = {},
): HiringRepository {
  const base: HiringRepository = {
    createInterest: () => Promise.resolve({} as unknown as HiringInterestRow),
    getInterestById: () => Promise.resolve(undefined),
    listInterestsByLeague: () => Promise.resolve([]),
    updateInterestStatus: () =>
      Promise.resolve({} as unknown as HiringInterestRow),
    createInterview: () => Promise.resolve({} as unknown as HiringInterviewRow),
    getInterviewById: () => Promise.resolve(undefined),
    listInterviewsByLeague: () => Promise.resolve([]),
    updateInterview: () => Promise.resolve({} as unknown as HiringInterviewRow),
    createOffer: () => Promise.resolve({} as unknown as HiringOfferRow),
    getOfferById: () => Promise.resolve(undefined),
    listOffersByLeague: () => Promise.resolve([]),
    updateOffer: () => Promise.resolve({} as unknown as HiringOfferRow),
    createDecision: () => Promise.resolve({} as unknown as HiringDecisionRow),
    listDecisionsByLeague: () => Promise.resolve([]),
    listUnassignedCoaches: () => Promise.resolve([] as UnassignedCandidate[]),
    listUnassignedScouts: () => Promise.resolve([] as UnassignedCandidate[]),
  };
  return { ...base, ...overrides };
}

function silentLog() {
  return pino({ level: "silent" });
}

Deno.test("hiringService: step methods throw NOT_IMPLEMENTED until the logic ticket lands", async () => {
  const service = createHiringService({
    repo: stubRepo(),
    log: silentLog(),
  });

  for (
    const call of [
      () => service.openMarket("lg"),
      () =>
        service.expressInterest({
          leagueId: "lg",
          teamId: "tm",
          staffType: "coach",
          staffId: "st",
          stepSlug: "hiring_market_survey",
        }),
      () =>
        service.requestInterviews({
          leagueId: "lg",
          teamId: "tm",
          stepSlug: "hiring_interview_1",
          targets: [{ staffType: "coach", staffId: "st" }],
        }),
      () => service.resolveInterviewDeclines("lg", "hiring_interview_1"),
      () =>
        service.submitOffers({
          leagueId: "lg",
          teamId: "tm",
          stepSlug: "hiring_offers",
          offers: [],
        }),
      () => service.resolveDecisions("lg", 1),
      () => service.finalize("lg"),
    ]
  ) {
    const err = await assertRejects(call, DomainError);
    assertEquals((err as DomainError).code, "NOT_IMPLEMENTED");
  }
});

Deno.test("hiringService.getHiringState: aggregates league rows from the repository", async () => {
  const interests: HiringInterestRow[] = [
    {
      id: "i-1",
      leagueId: "lg",
      teamId: "tm",
      staffType: "coach",
      staffId: "s-1",
      stepSlug: "hiring_market_survey",
      status: "active",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    },
  ];
  const interviews: HiringInterviewRow[] = [
    {
      id: "iv-1",
      leagueId: "lg",
      teamId: "tm",
      staffType: "scout",
      staffId: "s-2",
      stepSlug: "hiring_interview_1",
      status: "requested",
      philosophyReveal: null,
      staffFitReveal: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    },
  ];
  const offers: HiringOfferRow[] = [
    {
      id: "o-1",
      leagueId: "lg",
      teamId: "tm",
      staffType: "coach",
      staffId: "s-1",
      stepSlug: "hiring_offers",
      status: "pending",
      salary: 3_000_000,
      contractYears: 2,
      buyoutMultiplier: "0.50",
      incentives: [],
      preferenceScore: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    },
  ];
  const decisions: HiringDecisionRow[] = [
    {
      id: "d-1",
      leagueId: "lg",
      staffType: "coach",
      staffId: "s-1",
      chosenOfferId: "o-1",
      wave: 1,
      decidedAt: new Date(0),
      createdAt: new Date(0),
      updatedAt: new Date(0),
    },
  ];
  const unassignedCoaches: UnassignedCandidate[] = [
    {
      id: "c-pool",
      leagueId: "lg",
      firstName: "A",
      lastName: "B",
      role: "OC",
      marketTierPref: 50,
      philosophyFitPref: 50,
      staffFitPref: 50,
      compensationPref: 50,
      minimumThreshold: 30,
    },
  ];
  const unassignedScouts: UnassignedCandidate[] = [];

  const service = createHiringService({
    repo: stubRepo({
      listInterestsByLeague: (leagueId) => {
        assertEquals(leagueId, "lg");
        return Promise.resolve(interests);
      },
      listInterviewsByLeague: () => Promise.resolve(interviews),
      listOffersByLeague: () => Promise.resolve(offers),
      listDecisionsByLeague: () => Promise.resolve(decisions),
      listUnassignedCoaches: () => Promise.resolve(unassignedCoaches),
      listUnassignedScouts: () => Promise.resolve(unassignedScouts),
    }),
    log: silentLog(),
  });

  const state = await service.getHiringState("lg");
  assertEquals(state.leagueId, "lg");
  assertEquals(state.interests, interests);
  assertEquals(state.interviews, interviews);
  assertEquals(state.offers, offers);
  assertEquals(state.decisions, decisions);
  assertEquals(state.unassignedCoaches, unassignedCoaches);
  assertEquals(state.unassignedScouts, unassignedScouts);
});
