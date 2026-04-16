import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { DomainError } from "@zone-blitz/shared";
import pino from "pino";
import type {
  CandidateScoringContext,
  FranchiseScoringProfile,
  HiringDecisionRow,
  HiringInterestRow,
  HiringInterviewRow,
  HiringOfferRow,
  HiringRepository,
  SignedStaffMember,
  TeamScoringSummary,
  UnassignedCandidate,
} from "./hiring.repository.ts";
import { createHiringService } from "./hiring.service.ts";

function silentLog() {
  return pino({ level: "silent" });
}

interface StubLeague {
  id: string;
  numberOfTeams: number;
  staffBudget: number;
  interestCap: number;
  interviewsPerWeek: number;
  maxConcurrentOffers: number;
  userTeamId: string | null;
}

function stubLeagueRepo(league: StubLeague) {
  return {
    getById: (id: string) => {
      assertEquals(id, league.id);
      return Promise.resolve(league);
    },
  };
}

function stubGenerator() {
  const calls: { leagueId: string; numberOfTeams: number }[] = [];
  return {
    calls,
    generatePool: (input: { leagueId: string; numberOfTeams: number }) => {
      calls.push(input);
      return Promise.resolve({ coachCount: 0, scoutCount: 0 });
    },
  };
}

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
    salary: 1_000_000,
    contractYears: 2,
    buyoutMultiplier: "0.50",
    incentives: [],
    preferenceScore: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

function stubRepo(
  overrides: Partial<HiringRepository> = {},
): HiringRepository {
  const base: HiringRepository = {
    createInterest: () => Promise.resolve(makeInterest()),
    getInterestById: () => Promise.resolve(undefined),
    listInterestsByLeague: () => Promise.resolve([]),
    listInterestsByTeam: () => Promise.resolve([]),
    findActiveInterest: () => Promise.resolve(undefined),
    updateInterestStatus: () => Promise.resolve(makeInterest()),
    createInterview: () => Promise.resolve(makeInterview()),
    getInterviewById: () => Promise.resolve(undefined),
    listInterviewsByLeague: () => Promise.resolve([]),
    listInterviewsByTeam: () => Promise.resolve([]),
    listInterviewsByStep: () => Promise.resolve([]),
    findInterview: () => Promise.resolve(undefined),
    updateInterview: () => Promise.resolve(makeInterview()),
    createOffer: () => Promise.resolve(makeOffer()),
    getOfferById: () => Promise.resolve(undefined),
    listOffersByLeague: () => Promise.resolve([]),
    listOffersByTeam: () => Promise.resolve([]),
    listPendingOffersByLeague: () => Promise.resolve([]),
    updateOffer: () => Promise.resolve(makeOffer()),
    createDecision: () =>
      Promise.resolve(
        {
          id: crypto.randomUUID(),
          leagueId: "lg",
          staffType: "coach",
          staffId: crypto.randomUUID(),
          chosenOfferId: null,
          wave: 1,
          decidedAt: new Date(0),
          createdAt: new Date(0),
          updatedAt: new Date(0),
        } as HiringDecisionRow,
      ),
    listDecisionsByLeague: () => Promise.resolve([]),
    listUnassignedCoaches: () => Promise.resolve([] as UnassignedCandidate[]),
    listUnassignedScouts: () => Promise.resolve([] as UnassignedCandidate[]),
    getCandidateScoringContext: () => Promise.resolve(undefined),
    getFranchiseScoringProfile: () => Promise.resolve(undefined),
    sumSignedStaffSalaries: () => Promise.resolve(0),
    listTeamsForLeague: () => Promise.resolve([]),
    listSignedStaffByTeam: () => Promise.resolve([]),
    assignCoach: () => Promise.resolve(),
    assignScout: () => Promise.resolve(),
  };
  return { ...base, ...overrides };
}

const baseLeague: StubLeague = {
  id: "lg",
  numberOfTeams: 4,
  staffBudget: 50_000_000,
  interestCap: 3,
  interviewsPerWeek: 2,
  maxConcurrentOffers: 2,
  userTeamId: "user-team",
};

Deno.test("openMarket: invokes coach + scout pool generation with the league size", async () => {
  const coachGen = stubGenerator();
  const scoutGen = stubGenerator();
  const service = createHiringService({
    repo: stubRepo(),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: coachGen,
    scoutsService: scoutGen,
    log: silentLog(),
  });

  await service.openMarket("lg");

  assertEquals(coachGen.calls, [{ leagueId: "lg", numberOfTeams: 4 }]);
  assertEquals(scoutGen.calls, [{ leagueId: "lg", numberOfTeams: 4 }]);
});

Deno.test("openMarket: throws when the league is not found", async () => {
  const service = createHiringService({
    repo: stubRepo(),
    leagueRepo: { getById: () => Promise.resolve(undefined) },
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const err = await assertRejects(
    () => service.openMarket("missing"),
    DomainError,
  );
  assertEquals((err as DomainError).code, "NOT_FOUND");
});

Deno.test("expressInterest: creates an interest row when below the cap", async () => {
  const created = makeInterest({ teamId: "tm" });
  const service = createHiringService({
    repo: stubRepo({
      listInterestsByTeam: () => Promise.resolve([makeInterest()]),
      createInterest: (input) => {
        assertEquals(input.teamId, "tm");
        assertEquals(input.staffType, "coach");
        return Promise.resolve(created);
      },
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const row = await service.expressInterest({
    leagueId: "lg",
    teamId: "tm",
    staffType: "coach",
    staffId: created.staffId,
    stepSlug: "hiring_market_survey",
  });
  assertEquals(row.id, created.id);
});

Deno.test("expressInterest: rejects when the interest cap is reached", async () => {
  const existing = [
    makeInterest({ teamId: "tm" }),
    makeInterest({ teamId: "tm" }),
    makeInterest({ teamId: "tm" }),
  ];
  const service = createHiringService({
    repo: stubRepo({
      listInterestsByTeam: () => Promise.resolve(existing),
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const err = await assertRejects(
    () =>
      service.expressInterest({
        leagueId: "lg",
        teamId: "tm",
        staffType: "scout",
        staffId: crypto.randomUUID(),
        stepSlug: "hiring_market_survey",
      }),
    DomainError,
  );
  assertEquals((err as DomainError).code, "INTEREST_CAP_EXCEEDED");
});

Deno.test("expressInterest: ignores withdrawn interests when counting against the cap", async () => {
  const existing = [
    makeInterest({ teamId: "tm", status: "withdrawn" }),
    makeInterest({ teamId: "tm", status: "withdrawn" }),
    makeInterest({ teamId: "tm", status: "withdrawn" }),
  ];
  const created = makeInterest({ teamId: "tm" });
  const service = createHiringService({
    repo: stubRepo({
      listInterestsByTeam: () => Promise.resolve(existing),
      createInterest: () => Promise.resolve(created),
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const row = await service.expressInterest({
    leagueId: "lg",
    teamId: "tm",
    staffType: "coach",
    staffId: created.staffId,
    stepSlug: "hiring_market_survey",
  });
  assertEquals(row.id, created.id);
});

Deno.test("requestInterviews: creates a row per target when bandwidth allows", async () => {
  const targetA = crypto.randomUUID();
  const targetB = crypto.randomUUID();
  const interests = [
    makeInterest({ teamId: "tm", staffType: "coach", staffId: targetA }),
    makeInterest({ teamId: "tm", staffType: "scout", staffId: targetB }),
  ];
  const created: HiringInterviewRow[] = [];
  const service = createHiringService({
    repo: stubRepo({
      listInterestsByTeam: () => Promise.resolve(interests),
      listInterviewsByTeam: () => Promise.resolve([]),
      findActiveInterest: (_l, _t, staffType, staffId) => {
        const match = interests.find(
          (i) => i.staffType === staffType && i.staffId === staffId,
        );
        return Promise.resolve(match);
      },
      createInterview: (input) => {
        const row = makeInterview({
          teamId: input.teamId,
          staffType: input.staffType,
          staffId: input.staffId,
          stepSlug: input.stepSlug,
        });
        created.push(row);
        return Promise.resolve(row);
      },
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const rows = await service.requestInterviews({
    leagueId: "lg",
    teamId: "tm",
    stepSlug: "hiring_interview_1",
    targets: [
      { staffType: "coach", staffId: targetA },
      { staffType: "scout", staffId: targetB },
    ],
  });

  assertEquals(rows.length, 2);
  assertEquals(rows[0].stepSlug, "hiring_interview_1");
  assertEquals(created.length, 2);
});

Deno.test("requestInterviews: rejects when a target was not in the interest list", async () => {
  const service = createHiringService({
    repo: stubRepo({
      listInterestsByTeam: () => Promise.resolve([]),
      findActiveInterest: () => Promise.resolve(undefined),
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const err = await assertRejects(
    () =>
      service.requestInterviews({
        leagueId: "lg",
        teamId: "tm",
        stepSlug: "hiring_interview_1",
        targets: [{ staffType: "coach", staffId: crypto.randomUUID() }],
      }),
    DomainError,
  );
  assertEquals((err as DomainError).code, "INTEREST_REQUIRED");
});

Deno.test("requestInterviews: rejects when the per-week interview cap is exceeded", async () => {
  const targetA = crypto.randomUUID();
  const targetB = crypto.randomUUID();
  const targetC = crypto.randomUUID();
  const interests = [
    makeInterest({ teamId: "tm", staffId: targetA }),
    makeInterest({ teamId: "tm", staffId: targetB }),
    makeInterest({ teamId: "tm", staffId: targetC }),
  ];
  const existingThisWeek = [
    makeInterview({ teamId: "tm", stepSlug: "hiring_interview_1" }),
  ];
  const service = createHiringService({
    repo: stubRepo({
      listInterestsByTeam: () => Promise.resolve(interests),
      listInterviewsByTeam: () => Promise.resolve(existingThisWeek),
      findActiveInterest: (_l, _t, staffType, staffId) =>
        Promise.resolve(
          interests.find((i) =>
            i.staffType === staffType && i.staffId === staffId
          ),
        ),
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const err = await assertRejects(
    () =>
      service.requestInterviews({
        leagueId: "lg",
        teamId: "tm",
        stepSlug: "hiring_interview_1",
        targets: [
          { staffType: "coach", staffId: targetA },
          { staffType: "coach", staffId: targetB },
        ],
      }),
    DomainError,
  );
  assertEquals((err as DomainError).code, "INTERVIEW_CAP_EXCEEDED");
});

Deno.test("resolveInterviewDeclines: declines interviews below the candidate threshold and accepts above", async () => {
  const lowCandidateId = crypto.randomUUID();
  const highCandidateId = crypto.randomUUID();
  const lowInterview = makeInterview({
    staffType: "coach",
    staffId: lowCandidateId,
    teamId: "tm",
    stepSlug: "hiring_interview_1",
    status: "requested",
  });
  const highInterview = makeInterview({
    staffType: "scout",
    staffId: highCandidateId,
    teamId: "tm",
    stepSlug: "hiring_interview_1",
    status: "requested",
  });

  const candidates: Record<string, CandidateScoringContext> = {
    [lowCandidateId]: {
      staffType: "coach",
      staffId: lowCandidateId,
      role: "QB",
      preferences: {
        marketTierPref: 0,
        philosophyFitPref: 0,
        staffFitPref: 0,
        compensationPref: 100,
        minimumThreshold: 90,
      },
      offense: null,
      defense: null,
    },
    [highCandidateId]: {
      staffType: "scout",
      staffId: highCandidateId,
      role: "AREA_SCOUT",
      preferences: {
        marketTierPref: 100,
        philosophyFitPref: 0,
        staffFitPref: 0,
        compensationPref: 0,
        minimumThreshold: 10,
      },
      offense: null,
      defense: null,
    },
  };
  const profile: FranchiseScoringProfile = {
    teamId: "tm",
    marketTier: "large",
    existingStaff: [],
  };

  const updates: { id: string; status: string }[] = [];
  const service = createHiringService({
    repo: stubRepo({
      listInterviewsByStep: () =>
        Promise.resolve([lowInterview, highInterview]),
      getCandidateScoringContext: (_st, id) => Promise.resolve(candidates[id]),
      getFranchiseScoringProfile: (teamId) => {
        assertEquals(teamId, "tm");
        return Promise.resolve(profile);
      },
      updateInterview: (id, patch) => {
        updates.push({ id, status: patch.status as string });
        return Promise.resolve(
          makeInterview({
            id,
            status: patch.status as
              | "requested"
              | "accepted"
              | "declined"
              | "completed",
          }),
        );
      },
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const rows = await service.resolveInterviewDeclines(
    "lg",
    "hiring_interview_1",
  );

  assertEquals(rows.length, 2);
  const declined = updates.find((u) => u.id === lowInterview.id);
  const completed = updates.find((u) => u.id === highInterview.id);
  assertEquals(declined?.status, "declined");
  assertEquals(completed?.status, "completed");
});

Deno.test("submitOffers: persists offers when interview is completed and budget allows", async () => {
  const candidateId = crypto.randomUUID();
  const interview = makeInterview({
    teamId: "tm",
    staffType: "coach",
    staffId: candidateId,
    status: "completed",
    stepSlug: "hiring_interview_1",
  });
  const offerInputs = {
    leagueId: "lg",
    teamId: "tm",
    stepSlug: "hiring_offers",
    offers: [
      {
        staffType: "coach" as const,
        staffId: candidateId,
        salary: 2_000_000,
        contractYears: 3,
        buyoutMultiplier: "0.75",
        incentives: [{ type: "playoff", value: 250_000 }],
      },
    ],
  };
  const created: HiringOfferRow[] = [];
  const service = createHiringService({
    repo: stubRepo({
      listOffersByTeam: () => Promise.resolve([]),
      sumSignedStaffSalaries: () => Promise.resolve(10_000_000),
      findInterview: (_l, _t, st, id) => {
        if (st === "coach" && id === candidateId) {
          return Promise.resolve(interview);
        }
        return Promise.resolve(undefined);
      },
      createOffer: (input) => {
        const row = makeOffer({
          teamId: input.teamId,
          staffType: input.staffType,
          staffId: input.staffId,
          stepSlug: input.stepSlug,
          salary: input.salary,
          contractYears: input.contractYears,
          buyoutMultiplier: input.buyoutMultiplier,
          incentives: input.incentives ?? [],
        });
        created.push(row);
        return Promise.resolve(row);
      },
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const rows = await service.submitOffers(offerInputs);
  assertEquals(rows.length, 1);
  assertEquals(rows[0].salary, 2_000_000);
  assertEquals(created[0].buyoutMultiplier, "0.75");
});

Deno.test("submitOffers: rejects when the team has no completed interview for the candidate", async () => {
  const service = createHiringService({
    repo: stubRepo({
      listOffersByTeam: () => Promise.resolve([]),
      findInterview: () => Promise.resolve(undefined),
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const err = await assertRejects(
    () =>
      service.submitOffers({
        leagueId: "lg",
        teamId: "tm",
        stepSlug: "hiring_offers",
        offers: [
          {
            staffType: "coach",
            staffId: crypto.randomUUID(),
            salary: 1_000_000,
            contractYears: 2,
            buyoutMultiplier: "0.50",
          },
        ],
      }),
    DomainError,
  );
  assertEquals((err as DomainError).code, "INTERVIEW_REQUIRED");
});

Deno.test("submitOffers: rejects when concurrent offer cap is exceeded", async () => {
  const existing = [
    makeOffer({ teamId: "tm" }),
    makeOffer({ teamId: "tm" }),
  ];
  const service = createHiringService({
    repo: stubRepo({
      listOffersByTeam: () => Promise.resolve(existing),
      sumSignedStaffSalaries: () => Promise.resolve(0),
      findInterview: () =>
        Promise.resolve(makeInterview({ status: "completed" })),
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const err = await assertRejects(
    () =>
      service.submitOffers({
        leagueId: "lg",
        teamId: "tm",
        stepSlug: "hiring_offers",
        offers: [
          {
            staffType: "coach",
            staffId: crypto.randomUUID(),
            salary: 1_000_000,
            contractYears: 2,
            buyoutMultiplier: "0.50",
          },
        ],
      }),
    DomainError,
  );
  assertEquals((err as DomainError).code, "OFFER_CAP_EXCEEDED");
});

Deno.test("submitOffers: rejects when proposed salary plus existing obligations exceeds the staff budget", async () => {
  const candidateId = crypto.randomUUID();
  const interview = makeInterview({
    teamId: "tm",
    staffId: candidateId,
    status: "completed",
  });
  const service = createHiringService({
    repo: stubRepo({
      listOffersByTeam: () =>
        Promise.resolve([
          makeOffer({ teamId: "tm", salary: 30_000_000 }),
        ]),
      sumSignedStaffSalaries: () => Promise.resolve(15_000_000),
      findInterview: () => Promise.resolve(interview),
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const err = await assertRejects(
    () =>
      service.submitOffers({
        leagueId: "lg",
        teamId: "tm",
        stepSlug: "hiring_offers",
        offers: [
          {
            staffType: "coach",
            staffId: candidateId,
            salary: 6_000_000,
            contractYears: 3,
            buyoutMultiplier: "0.50",
          },
        ],
      }),
    DomainError,
  );
  assertEquals((err as DomainError).code, "STAFF_BUDGET_EXCEEDED");
});

Deno.test("resolveDecisions: chooses the winning offer per candidate, updates the staff row, and creates a decision", async () => {
  const candidateId = crypto.randomUUID();
  const winningTeam = "tm-winner";
  const losingTeam = "tm-loser";

  const winningOffer = makeOffer({
    teamId: winningTeam,
    staffType: "coach",
    staffId: candidateId,
    salary: 4_000_000,
    contractYears: 4,
    buyoutMultiplier: "0.75",
  });
  const losingOffer = makeOffer({
    teamId: losingTeam,
    staffType: "coach",
    staffId: candidateId,
    salary: 1_000_000,
    contractYears: 2,
    buyoutMultiplier: "0.50",
  });

  const candidate: CandidateScoringContext = {
    staffType: "coach",
    staffId: candidateId,
    role: "OC",
    preferences: {
      marketTierPref: 0,
      philosophyFitPref: 0,
      staffFitPref: 0,
      compensationPref: 100,
      minimumThreshold: 0,
    },
    offense: null,
    defense: null,
  };

  const profiles: Record<string, FranchiseScoringProfile> = {
    [winningTeam]: {
      teamId: winningTeam,
      marketTier: "small",
      existingStaff: [],
    },
    [losingTeam]: {
      teamId: losingTeam,
      marketTier: "small",
      existingStaff: [],
    },
  };

  const updatedOffers: { id: string; status: string }[] = [];
  const decisions: HiringDecisionRow[] = [];
  const assigned: {
    coachId: string;
    teamId: string;
    reportsToId?: string | null;
  }[] = [];

  const service = createHiringService({
    repo: stubRepo({
      listPendingOffersByLeague: () =>
        Promise.resolve([losingOffer, winningOffer]),
      getCandidateScoringContext: () => Promise.resolve(candidate),
      getFranchiseScoringProfile: (teamId) => Promise.resolve(profiles[teamId]),
      listSignedStaffByTeam: () => Promise.resolve([]),
      updateOffer: (id, patch) => {
        updatedOffers.push({ id, status: patch.status as string });
        return Promise.resolve(makeOffer({ id }));
      },
      createDecision: (input) => {
        const row: HiringDecisionRow = {
          id: crypto.randomUUID(),
          leagueId: input.leagueId,
          staffType: input.staffType,
          staffId: input.staffId,
          chosenOfferId: input.chosenOfferId,
          wave: input.wave,
          decidedAt: new Date(0),
          createdAt: new Date(0),
          updatedAt: new Date(0),
        };
        decisions.push(row);
        return Promise.resolve(row);
      },
      assignCoach: (coachId, patch) => {
        assigned.push({
          coachId,
          teamId: patch.teamId,
          reportsToId: patch.reportsToId,
        });
        return Promise.resolve();
      },
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const result = await service.resolveDecisions("lg", 1);

  assertEquals(result.length, 1);
  assertEquals(result[0].chosenOfferId, winningOffer.id);
  const winningPatch = updatedOffers.find((u) => u.id === winningOffer.id);
  const losingPatch = updatedOffers.find((u) => u.id === losingOffer.id);
  assertEquals(winningPatch?.status, "accepted");
  assertEquals(losingPatch?.status, "rejected");
  assertEquals(assigned.length, 1);
  assertEquals(assigned[0].teamId, winningTeam);
});

Deno.test("resolveDecisions: records a no-signing when the candidate refuses every offer", async () => {
  const candidateId = crypto.randomUUID();
  const offer = makeOffer({
    teamId: "tm",
    staffType: "scout",
    staffId: candidateId,
    salary: 50_000,
  });
  const candidate: CandidateScoringContext = {
    staffType: "scout",
    staffId: candidateId,
    role: "AREA_SCOUT",
    preferences: {
      marketTierPref: 0,
      philosophyFitPref: 0,
      staffFitPref: 0,
      compensationPref: 100,
      minimumThreshold: 95,
    },
    offense: null,
    defense: null,
  };
  const profile: FranchiseScoringProfile = {
    teamId: "tm",
    marketTier: "small",
    existingStaff: [],
  };

  const updatedOffers: { id: string; status: string }[] = [];
  const decisions: HiringDecisionRow[] = [];
  let assignmentCount = 0;
  const service = createHiringService({
    repo: stubRepo({
      listPendingOffersByLeague: () => Promise.resolve([offer]),
      getCandidateScoringContext: () => Promise.resolve(candidate),
      getFranchiseScoringProfile: () => Promise.resolve(profile),
      updateOffer: (id, patch) => {
        updatedOffers.push({ id, status: patch.status as string });
        return Promise.resolve(makeOffer({ id }));
      },
      createDecision: (input) => {
        const row: HiringDecisionRow = {
          id: crypto.randomUUID(),
          leagueId: input.leagueId,
          staffType: input.staffType,
          staffId: input.staffId,
          chosenOfferId: input.chosenOfferId,
          wave: input.wave,
          decidedAt: new Date(0),
          createdAt: new Date(0),
          updatedAt: new Date(0),
        };
        decisions.push(row);
        return Promise.resolve(row);
      },
      assignScout: () => {
        assignmentCount++;
        return Promise.resolve();
      },
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const result = await service.resolveDecisions("lg", 1);

  assertEquals(result.length, 1);
  assertEquals(result[0].chosenOfferId, null);
  assertEquals(updatedOffers[0].status, "rejected");
  assertEquals(assignmentCount, 0);
});

Deno.test("finalize: auto-assigns NPC teams missing mandatory roles and lists blockers for the human team", async () => {
  const userTeam = "user-team";
  const npcTeam = "npc-team";
  const teams: TeamScoringSummary[] = [
    { teamId: userTeam, marketTier: "large" },
    { teamId: npcTeam, marketTier: "small" },
  ];

  const npcStaff: Record<string, SignedStaffMember[]> = {
    [userTeam]: [],
    [npcTeam]: [],
  };

  const hcCandidate: UnassignedCandidate = {
    id: crypto.randomUUID(),
    leagueId: "lg",
    firstName: "Auto",
    lastName: "HC",
    role: "HC",
    marketTierPref: 100,
    philosophyFitPref: 0,
    staffFitPref: 0,
    compensationPref: 0,
    minimumThreshold: 0,
  };
  const directorCandidate: UnassignedCandidate = {
    id: crypto.randomUUID(),
    leagueId: "lg",
    firstName: "Auto",
    lastName: "Dir",
    role: "DIRECTOR",
    marketTierPref: 100,
    philosophyFitPref: 0,
    staffFitPref: 0,
    compensationPref: 0,
    minimumThreshold: 0,
  };

  const assignedCoaches: { coachId: string; teamId: string }[] = [];
  const assignedScouts: { scoutId: string; teamId: string }[] = [];
  const decisions: HiringDecisionRow[] = [];

  const service = createHiringService({
    repo: stubRepo({
      listTeamsForLeague: () => Promise.resolve(teams),
      listSignedStaffByTeam: (_l, teamId) =>
        Promise.resolve(npcStaff[teamId] ?? []),
      listUnassignedCoaches: () => Promise.resolve([hcCandidate]),
      listUnassignedScouts: () => Promise.resolve([directorCandidate]),
      assignCoach: (coachId, patch) => {
        assignedCoaches.push({ coachId, teamId: patch.teamId });
        return Promise.resolve();
      },
      assignScout: (scoutId, patch) => {
        assignedScouts.push({ scoutId, teamId: patch.teamId });
        return Promise.resolve();
      },
      createDecision: (input) => {
        const row: HiringDecisionRow = {
          id: crypto.randomUUID(),
          leagueId: input.leagueId,
          staffType: input.staffType,
          staffId: input.staffId,
          chosenOfferId: input.chosenOfferId,
          wave: input.wave,
          decidedAt: new Date(0),
          createdAt: new Date(0),
          updatedAt: new Date(0),
        };
        decisions.push(row);
        return Promise.resolve(row);
      },
    }),
    leagueRepo: stubLeagueRepo({ ...baseLeague, userTeamId: userTeam }),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const result = await service.finalize("lg");

  assertEquals(assignedCoaches.length, 1);
  assertEquals(assignedCoaches[0].teamId, npcTeam);
  assertEquals(assignedScouts.length, 1);
  assertEquals(assignedScouts[0].teamId, npcTeam);
  assertEquals(result.decisions.length, 2);
  assertEquals(result.blockers.length, 1);
  assertEquals(result.blockers[0].teamId, userTeam);
  assertEquals(result.blockers[0].missingRoles.sort(), ["DIRECTOR", "HC"]);
});

Deno.test("finalize: returns no blockers when every team is filled", async () => {
  const userTeam = "user-team";
  const teams: TeamScoringSummary[] = [
    { teamId: userTeam, marketTier: "large" },
  ];
  const filledStaff: SignedStaffMember[] = [
    {
      staffType: "coach",
      staffId: crypto.randomUUID(),
      role: "HC",
      contractSalary: 1_000_000,
    },
    {
      staffType: "scout",
      staffId: crypto.randomUUID(),
      role: "DIRECTOR",
      contractSalary: 250_000,
    },
  ];
  const service = createHiringService({
    repo: stubRepo({
      listTeamsForLeague: () => Promise.resolve(teams),
      listSignedStaffByTeam: () => Promise.resolve(filledStaff),
      listUnassignedCoaches: () => Promise.resolve([]),
      listUnassignedScouts: () => Promise.resolve([]),
    }),
    leagueRepo: stubLeagueRepo({ ...baseLeague, userTeamId: userTeam }),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const result = await service.finalize("lg");
  assertEquals(result.blockers, []);
  assertEquals(result.decisions, []);
});

Deno.test("getHiringState: aggregates league rows from the repository", async () => {
  const interests = [makeInterest()];
  const interviews = [makeInterview()];
  const offers = [makeOffer()];
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
  const unassignedCoaches: UnassignedCandidate[] = [];
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
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
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
  assertExists(state);
});

function makeUnassigned(
  overrides: Partial<UnassignedCandidate> = {},
): UnassignedCandidate {
  return {
    id: crypto.randomUUID(),
    leagueId: "lg",
    firstName: "First",
    lastName: "Last",
    role: "HC",
    marketTierPref: 50,
    philosophyFitPref: 50,
    staffFitPref: 50,
    compensationPref: 50,
    minimumThreshold: 50,
    ...overrides,
  };
}

Deno.test("listCandidates: returns coaches and scouts tagged with staff type", async () => {
  const coach = makeUnassigned({ role: "HC" });
  const scout = makeUnassigned({ role: "DIRECTOR" });
  const service = createHiringService({
    repo: stubRepo({
      listUnassignedCoaches: () => Promise.resolve([coach]),
      listUnassignedScouts: () => Promise.resolve([scout]),
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const rows = await service.listCandidates("lg");
  assertEquals(rows.length, 2);
  const coachRow = rows.find((r) => r.id === coach.id);
  const scoutRow = rows.find((r) => r.id === scout.id);
  assertEquals(coachRow?.staffType, "coach");
  assertEquals(scoutRow?.staffType, "scout");
  assertEquals(coachRow?.role, "HC");
  assertEquals(scoutRow?.role, "DIRECTOR");
});

Deno.test("listCandidates: filters by staffType", async () => {
  const coach = makeUnassigned({ role: "HC" });
  const scout = makeUnassigned({ role: "DIRECTOR" });
  const service = createHiringService({
    repo: stubRepo({
      listUnassignedCoaches: () => Promise.resolve([coach]),
      listUnassignedScouts: () => Promise.resolve([scout]),
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const rows = await service.listCandidates("lg", { staffType: "coach" });
  assertEquals(rows.length, 1);
  assertEquals(rows[0].id, coach.id);
});

Deno.test("listCandidates: filters by role", async () => {
  const hc = makeUnassigned({ role: "HC" });
  const oc = makeUnassigned({ role: "OC" });
  const service = createHiringService({
    repo: stubRepo({
      listUnassignedCoaches: () => Promise.resolve([hc, oc]),
      listUnassignedScouts: () => Promise.resolve([]),
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const rows = await service.listCandidates("lg", { role: "OC" });
  assertEquals(rows.length, 1);
  assertEquals(rows[0].id, oc.id);
});

Deno.test("getCandidateDetail: returns undefined when candidate is not in either pool", async () => {
  const service = createHiringService({
    repo: stubRepo({
      listUnassignedCoaches: () => Promise.resolve([]),
      listUnassignedScouts: () => Promise.resolve([]),
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const detail = await service.getCandidateDetail(
    "lg",
    crypto.randomUUID(),
  );
  assertEquals(detail, undefined);
});

Deno.test("getCandidateDetail: returns detail with null interview reveal when viewer has no completed interview", async () => {
  const coach = makeUnassigned({ role: "HC" });
  const service = createHiringService({
    repo: stubRepo({
      listUnassignedCoaches: () => Promise.resolve([coach]),
      listUnassignedScouts: () => Promise.resolve([]),
      findInterview: () => Promise.resolve(undefined),
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const detail = await service.getCandidateDetail(
    "lg",
    coach.id,
    "tm",
  );
  assertEquals(detail?.id, coach.id);
  assertEquals(detail?.staffType, "coach");
  assertEquals(detail?.interviewReveal, null);
});

Deno.test("getCandidateDetail: returns interview reveal when viewer has completed interview", async () => {
  const scout = makeUnassigned({ role: "DIRECTOR" });
  const interview = makeInterview({
    teamId: "tm",
    staffType: "scout",
    staffId: scout.id,
    status: "completed",
    philosophyReveal: { tempo: "up" },
    staffFitReveal: { chemistry: "high" },
  });
  const service = createHiringService({
    repo: stubRepo({
      listUnassignedCoaches: () => Promise.resolve([]),
      listUnassignedScouts: () => Promise.resolve([scout]),
      findInterview: (_l, teamId, staffType, staffId) => {
        assertEquals(teamId, "tm");
        assertEquals(staffType, "scout");
        assertEquals(staffId, scout.id);
        return Promise.resolve(interview);
      },
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const detail = await service.getCandidateDetail(
    "lg",
    scout.id,
    "tm",
  );
  assertEquals(detail?.interviewReveal?.philosophyReveal, { tempo: "up" });
  assertEquals(detail?.interviewReveal?.staffFitReveal, { chemistry: "high" });
});

Deno.test("getCandidateDetail: omits interview reveal when interview is not completed", async () => {
  const coach = makeUnassigned({ role: "QB" });
  const interview = makeInterview({
    teamId: "tm",
    staffType: "coach",
    staffId: coach.id,
    status: "requested",
  });
  const service = createHiringService({
    repo: stubRepo({
      listUnassignedCoaches: () => Promise.resolve([coach]),
      listUnassignedScouts: () => Promise.resolve([]),
      findInterview: () => Promise.resolve(interview),
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const detail = await service.getCandidateDetail(
    "lg",
    coach.id,
    "tm",
  );
  assertEquals(detail?.interviewReveal, null);
});

Deno.test("resolveCandidate: returns staffType for a candidate in either pool", async () => {
  const coach = makeUnassigned({ role: "HC" });
  const scout = makeUnassigned({ role: "DIRECTOR" });
  const service = createHiringService({
    repo: stubRepo({
      listUnassignedCoaches: () => Promise.resolve([coach]),
      listUnassignedScouts: () => Promise.resolve([scout]),
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  assertEquals(await service.resolveCandidate("lg", coach.id), {
    staffType: "coach",
    staffId: coach.id,
  });
  assertEquals(await service.resolveCandidate("lg", scout.id), {
    staffType: "scout",
    staffId: scout.id,
  });
  assertEquals(
    await service.resolveCandidate("lg", crypto.randomUUID()),
    undefined,
  );
});

Deno.test("getTeamHiringState: aggregates team-scoped rows and computes remaining budget", async () => {
  const interests = [makeInterest({ teamId: "tm" })];
  const interviews = [makeInterview({ teamId: "tm" })];
  const offers = [makeOffer({ teamId: "tm", salary: 5_000_000 })];
  const decisions: HiringDecisionRow[] = [];

  const service = createHiringService({
    repo: stubRepo({
      listInterestsByTeam: (leagueId, teamId) => {
        assertEquals(leagueId, "lg");
        assertEquals(teamId, "tm");
        return Promise.resolve(interests);
      },
      listInterviewsByTeam: () => Promise.resolve(interviews),
      listOffersByTeam: () => Promise.resolve(offers),
      listDecisionsByLeague: () => Promise.resolve(decisions),
      sumSignedStaffSalaries: (teamId) => {
        assertEquals(teamId, "tm");
        return Promise.resolve(20_000_000);
      },
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const state = await service.getTeamHiringState("lg", "tm");
  assertEquals(state.leagueId, "lg");
  assertEquals(state.teamId, "tm");
  assertEquals(state.interests, interests);
  assertEquals(state.interviews, interviews);
  assertEquals(state.offers, offers);
  assertEquals(state.decisions, decisions);
  assertEquals(state.staffBudget, baseLeague.staffBudget);
  // 50M budget - 20M signed - 5M pending = 25M
  assertEquals(state.remainingBudget, 25_000_000);
});

Deno.test("listDecisions: returns all decisions when no wave filter is given", async () => {
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
    {
      id: "d-2",
      leagueId: "lg",
      staffType: "coach",
      staffId: "s-2",
      chosenOfferId: null,
      wave: 2,
      decidedAt: new Date(0),
      createdAt: new Date(0),
      updatedAt: new Date(0),
    },
  ];
  const service = createHiringService({
    repo: stubRepo({
      listDecisionsByLeague: () => Promise.resolve(decisions),
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const all = await service.listDecisions("lg");
  assertEquals(all.length, 2);
});

Deno.test("listDecisions: filters by wave when given", async () => {
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
    {
      id: "d-2",
      leagueId: "lg",
      staffType: "coach",
      staffId: "s-2",
      chosenOfferId: null,
      wave: 2,
      decidedAt: new Date(0),
      createdAt: new Date(0),
      updatedAt: new Date(0),
    },
  ];
  const service = createHiringService({
    repo: stubRepo({
      listDecisionsByLeague: () => Promise.resolve(decisions),
    }),
    leagueRepo: stubLeagueRepo(baseLeague),
    coachesService: stubGenerator(),
    scoutsService: stubGenerator(),
    log: silentLog(),
  });

  const waveOne = await service.listDecisions("lg", 1);
  assertEquals(waveOne.length, 1);
  assertEquals(waveOne[0].wave, 1);
});
