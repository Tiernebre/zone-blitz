import { assertEquals } from "@std/assert";
import { mulberry32 } from "@zone-blitz/shared";
import pino from "pino";
import type {
  CandidateScoringContext,
  FranchiseScoringProfile,
  HiringInterestRow,
  HiringInterviewRow,
  HiringOfferRow,
  HiringRepository,
  SignedStaffMember,
  UnassignedCandidate,
} from "./hiring.repository.ts";
import type {
  DraftOffer,
  HiringLeagueRepository,
  HiringLeagueSummary,
  HiringService,
  InterestTarget,
} from "./hiring.service.ts";
import { createNpcHiringAi } from "./npc-hiring-ai.ts";

function silentLog() {
  return pino({ level: "silent" });
}

function makeInterest(
  overrides: Partial<HiringInterestRow> = {},
): HiringInterestRow {
  return {
    id: crypto.randomUUID(),
    leagueId: "lg",
    teamId: "npc-a",
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
    teamId: "npc-a",
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
    teamId: "npc-a",
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

function makeUnassigned(
  overrides: Partial<UnassignedCandidate> = {},
): UnassignedCandidate {
  return {
    id: crypto.randomUUID(),
    leagueId: "lg",
    firstName: "First",
    lastName: "Last",
    role: "HC",
    specialty: null,
    age: 45,
    yearsExperience: 15,
    positionBackground: null,
    positionFocus: null,
    regionFocus: null,
    marketTierPref: 50,
    philosophyFitPref: 50,
    staffFitPref: 50,
    compensationPref: 50,
    minimumThreshold: 40,
    ...overrides,
  };
}

function toContext(
  c: UnassignedCandidate,
  staffType: "coach" | "scout" = "coach",
): CandidateScoringContext {
  return {
    staffType,
    staffId: c.id,
    role: c.role as CandidateScoringContext["role"],
    preferences: {
      marketTierPref: c.marketTierPref ?? 50,
      philosophyFitPref: c.philosophyFitPref ?? 50,
      staffFitPref: c.staffFitPref ?? 50,
      compensationPref: c.compensationPref ?? 50,
      minimumThreshold: c.minimumThreshold ?? 50,
    },
    offense: null,
    defense: null,
  };
}

const defaultLeague: HiringLeagueSummary = {
  id: "lg",
  numberOfTeams: 4,
  staffBudget: 50_000_000,
  interestCap: 3,
  interviewsPerWeek: 2,
  maxConcurrentOffers: 2,
  userTeamId: null,
};

function stubLeagueRepo(
  league: HiringLeagueSummary = defaultLeague,
): HiringLeagueRepository {
  return {
    getById: (id) => {
      assertEquals(id, league.id);
      return Promise.resolve(league);
    },
  };
}

function stubRepo(overrides: Partial<HiringRepository> = {}): HiringRepository {
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
      Promise.resolve({
        id: crypto.randomUUID(),
        leagueId: "lg",
        staffType: "coach",
        staffId: crypto.randomUUID(),
        chosenOfferId: null,
        wave: 1,
        decidedAt: new Date(0),
        createdAt: new Date(0),
        updatedAt: new Date(0),
      }),
    listDecisionsByLeague: () => Promise.resolve([]),
    listUnassignedCoaches: () => Promise.resolve([]),
    listUnassignedScouts: () => Promise.resolve([]),
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

interface ServiceCalls {
  interest: {
    leagueId: string;
    teamId: string;
    staffType: "coach" | "scout";
    staffId: string;
    stepSlug: string;
  }[];
  interviews: {
    leagueId: string;
    teamId: string;
    stepSlug: string;
    targets: InterestTarget[];
  }[];
  offers: {
    leagueId: string;
    teamId: string;
    stepSlug: string;
    offers: DraftOffer[];
  }[];
}

function stubService(overrides: Partial<HiringService> = {}): {
  service: HiringService;
  calls: ServiceCalls;
} {
  const calls: ServiceCalls = {
    interest: [],
    interviews: [],
    offers: [],
  };
  const base: HiringService = {
    openMarket: () => Promise.resolve(),
    expressInterest: (input) => {
      calls.interest.push({ ...input });
      return Promise.resolve(
        makeInterest({
          leagueId: input.leagueId,
          teamId: input.teamId,
          staffType: input.staffType,
          staffId: input.staffId,
          stepSlug: input.stepSlug,
        }),
      );
    },
    requestInterviews: (input) => {
      calls.interviews.push({
        leagueId: input.leagueId,
        teamId: input.teamId,
        stepSlug: input.stepSlug,
        targets: [...input.targets],
      });
      return Promise.resolve(
        input.targets.map((t) =>
          makeInterview({
            leagueId: input.leagueId,
            teamId: input.teamId,
            staffType: t.staffType,
            staffId: t.staffId,
            stepSlug: input.stepSlug,
          })
        ),
      );
    },
    resolveInterviewDeclines: () => Promise.resolve([]),
    submitOffers: (input) => {
      calls.offers.push({
        leagueId: input.leagueId,
        teamId: input.teamId,
        stepSlug: input.stepSlug,
        offers: [...input.offers],
      });
      return Promise.resolve(
        input.offers.map((o) =>
          makeOffer({
            leagueId: input.leagueId,
            teamId: input.teamId,
            staffType: o.staffType,
            staffId: o.staffId,
            stepSlug: input.stepSlug,
            salary: o.salary,
            contractYears: o.contractYears,
            buyoutMultiplier: o.buyoutMultiplier,
            incentives: o.incentives ?? [],
          })
        ),
      );
    },
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
    getTeamHiringState: (leagueId, teamId) =>
      Promise.resolve({
        leagueId,
        teamId,
        staffBudget: 50_000_000,
        remainingBudget: 50_000_000,
        interests: [],
        interviews: [],
        offers: [],
        decisions: [],
      }),
    listCandidates: () => Promise.resolve([]),
    getCandidateDetail: () => Promise.resolve(undefined),
    resolveCandidate: () => Promise.resolve(undefined),
    listDecisions: () => Promise.resolve([]),
  };
  return { service: { ...base, ...overrides }, calls };
}

Deno.test("executeNpcInterest: only contests for HC and Director (subordinate roles ignored)", async () => {
  const hc = makeUnassigned({ role: "HC" });
  const oc = makeUnassigned({ role: "OC" });
  const areaScout = makeUnassigned({ role: "AREA_SCOUT" });
  const director = makeUnassigned({ role: "DIRECTOR" });

  const { service, calls } = stubService();
  const ai = createNpcHiringAi({
    repo: stubRepo({
      listUnassignedCoaches: () => Promise.resolve([oc, hc]),
      listUnassignedScouts: () => Promise.resolve([areaScout, director]),
      listInterestsByTeam: () => Promise.resolve([]),
      listSignedStaffByTeam: () => Promise.resolve([]),
      getFranchiseScoringProfile: (teamId) =>
        Promise.resolve({
          teamId,
          marketTier: "medium",
          existingStaff: [],
        } as FranchiseScoringProfile),
      getCandidateScoringContext: (staffType, id) => {
        const candidate = [hc, oc, director, areaScout].find((c) =>
          c.id === id
        );
        if (!candidate) return Promise.resolve(undefined);
        return Promise.resolve(toContext(candidate, staffType));
      },
    }),
    leagueRepo: stubLeagueRepo({ ...defaultLeague, interestCap: 5 }),
    service,
    log: silentLog(),
  });

  await ai.executeNpcInterest({
    leagueId: "lg",
    npcTeamIds: ["npc-a"],
    stepSlug: "hiring_market_survey",
  });

  // Only HC and DIRECTOR are leadership roles, so only those are pursued.
  assertEquals(calls.interest.length, 2);
  const ids = calls.interest.map((i) => i.staffId).sort();
  assertEquals(ids, [hc.id, director.id].sort());
  // HC (priority 0) must come before DIRECTOR (priority 3).
  assertEquals(calls.interest[0].staffId, hc.id);
});

Deno.test("executeNpcInterest: respects interest cap minus existing active interests", async () => {
  const hcA = makeUnassigned({ role: "HC" });
  const hcB = makeUnassigned({ role: "HC" });
  const directorA = makeUnassigned({ role: "DIRECTOR" });

  const existing = [
    makeInterest({ teamId: "npc-a", staffType: "coach", staffId: "prev-1" }),
    makeInterest({
      teamId: "npc-a",
      staffType: "coach",
      staffId: "prev-2",
      status: "withdrawn",
    }),
  ];

  const { service, calls } = stubService();
  const ai = createNpcHiringAi({
    repo: stubRepo({
      listUnassignedCoaches: () => Promise.resolve([hcA, hcB]),
      listUnassignedScouts: () => Promise.resolve([directorA]),
      listInterestsByTeam: () => Promise.resolve(existing),
      listSignedStaffByTeam: () => Promise.resolve([]),
      getFranchiseScoringProfile: (teamId) =>
        Promise.resolve({
          teamId,
          marketTier: "small",
          existingStaff: [],
        } as FranchiseScoringProfile),
      getCandidateScoringContext: (staffType, id) => {
        const candidate = [hcA, hcB, directorA].find((c) => c.id === id);
        if (!candidate) return Promise.resolve(undefined);
        return Promise.resolve(toContext(candidate, staffType));
      },
    }),
    leagueRepo: stubLeagueRepo({ ...defaultLeague, interestCap: 3 }),
    service,
    log: silentLog(),
  });

  await ai.executeNpcInterest({
    leagueId: "lg",
    npcTeamIds: ["npc-a"],
    stepSlug: "hiring_market_survey",
  });

  // 3 cap minus 1 active = 2 slots available, all leadership candidates.
  assertEquals(calls.interest.length, 2);
});

Deno.test("executeNpcInterest: skips HC role when the team already signed an HC", async () => {
  const hc2 = makeUnassigned({ role: "HC" });
  const director = makeUnassigned({ role: "DIRECTOR" });

  const signed: SignedStaffMember[] = [
    {
      staffType: "coach",
      staffId: "already-hc",
      role: "HC",
      contractSalary: 10_000_000,
    },
  ];

  const { service, calls } = stubService();
  const ai = createNpcHiringAi({
    repo: stubRepo({
      listUnassignedCoaches: () => Promise.resolve([hc2]),
      listUnassignedScouts: () => Promise.resolve([director]),
      listInterestsByTeam: () => Promise.resolve([]),
      listSignedStaffByTeam: () => Promise.resolve(signed),
      getFranchiseScoringProfile: (teamId) =>
        Promise.resolve({
          teamId,
          marketTier: "medium",
          existingStaff: [],
        } as FranchiseScoringProfile),
      getCandidateScoringContext: (staffType, id) => {
        const candidate = [hc2, director].find((c) => c.id === id);
        if (!candidate) return Promise.resolve(undefined);
        return Promise.resolve(toContext(candidate, staffType));
      },
    }),
    leagueRepo: stubLeagueRepo(),
    service,
    log: silentLog(),
  });

  await ai.executeNpcInterest({
    leagueId: "lg",
    npcTeamIds: ["npc-a"],
    stepSlug: "hiring_market_survey",
  });

  const hcInterest = calls.interest.find((i) => i.staffId === hc2.id);
  const directorInterest = calls.interest.find((i) =>
    i.staffId === director.id
  );
  assertEquals(hcInterest, undefined);
  assertEquals(directorInterest?.staffType, "scout");
});

Deno.test("executeNpcInterest: deterministic with a seeded rng when candidates tie", async () => {
  const hcA = makeUnassigned({ role: "HC" });
  const hcB = makeUnassigned({ role: "HC" });

  async function run(seed: number) {
    const { service, calls } = stubService();
    const ai = createNpcHiringAi({
      repo: stubRepo({
        listUnassignedCoaches: () => Promise.resolve([hcA, hcB]),
        listUnassignedScouts: () => Promise.resolve([]),
        listInterestsByTeam: () => Promise.resolve([]),
        listSignedStaffByTeam: () => Promise.resolve([]),
        getFranchiseScoringProfile: (teamId) =>
          Promise.resolve({
            teamId,
            marketTier: "medium",
            existingStaff: [],
          } as FranchiseScoringProfile),
        getCandidateScoringContext: (staffType, id) => {
          const candidate = [hcA, hcB].find((c) => c.id === id);
          if (!candidate) return Promise.resolve(undefined);
          return Promise.resolve(toContext(candidate, staffType));
        },
      }),
      leagueRepo: stubLeagueRepo({ ...defaultLeague, interestCap: 1 }),
      service,
      log: silentLog(),
      rng: mulberry32(seed),
    });
    await ai.executeNpcInterest({
      leagueId: "lg",
      npcTeamIds: ["npc-a"],
      stepSlug: "hiring_market_survey",
    });
    return calls.interest.map((i) => i.staffId);
  }

  const run1 = await run(42);
  const run2 = await run(42);
  assertEquals(run1, run2);
  assertEquals(run1.length, 1);
});

Deno.test("executeNpcInterviews: interviews HC before Director when both active interests are present", async () => {
  const hcInterest = makeInterest({
    teamId: "npc-a",
    staffType: "coach",
    staffId: "hc-1",
  });
  const dirInterest = makeInterest({
    teamId: "npc-a",
    staffType: "scout",
    staffId: "dir-1",
  });

  const candidates: Record<string, CandidateScoringContext> = {
    "hc-1": {
      staffType: "coach",
      staffId: "hc-1",
      role: "HC",
      preferences: {
        marketTierPref: 50,
        philosophyFitPref: 50,
        staffFitPref: 50,
        compensationPref: 50,
        minimumThreshold: 40,
      },
      offense: null,
      defense: null,
    },
    "dir-1": {
      staffType: "scout",
      staffId: "dir-1",
      role: "DIRECTOR",
      preferences: {
        marketTierPref: 50,
        philosophyFitPref: 50,
        staffFitPref: 50,
        compensationPref: 50,
        minimumThreshold: 40,
      },
      offense: null,
      defense: null,
    },
  };

  const { service, calls } = stubService();
  const ai = createNpcHiringAi({
    repo: stubRepo({
      listInterestsByTeam: () => Promise.resolve([dirInterest, hcInterest]),
      listInterviewsByTeam: () => Promise.resolve([]),
      getCandidateScoringContext: (_st, id) => Promise.resolve(candidates[id]),
      getFranchiseScoringProfile: (teamId) =>
        Promise.resolve({
          teamId,
          marketTier: "medium",
          existingStaff: [],
        } as FranchiseScoringProfile),
    }),
    leagueRepo: stubLeagueRepo({ ...defaultLeague, interviewsPerWeek: 2 }),
    service,
    log: silentLog(),
  });

  await ai.executeNpcInterviews({
    leagueId: "lg",
    npcTeamIds: ["npc-a"],
    stepSlug: "hiring_interview_1",
  });

  assertEquals(calls.interviews.length, 1);
  const [req] = calls.interviews;
  assertEquals(req.targets.length, 2);
  // HC priority 0 ranks ahead of DIRECTOR priority 3.
  assertEquals(req.targets[0].staffId, "hc-1");
  assertEquals(req.targets[1].staffId, "dir-1");
});

Deno.test("executeNpcInterviews: does not re-request interviews for candidates already interviewed this step", async () => {
  const hcInterest = makeInterest({
    teamId: "npc-a",
    staffType: "coach",
    staffId: "hc-1",
  });
  const existingInterview = makeInterview({
    teamId: "npc-a",
    staffType: "coach",
    staffId: "hc-1",
    stepSlug: "hiring_interview_1",
  });

  const { service, calls } = stubService();
  const ai = createNpcHiringAi({
    repo: stubRepo({
      listInterestsByTeam: () => Promise.resolve([hcInterest]),
      listInterviewsByTeam: () => Promise.resolve([existingInterview]),
      getCandidateScoringContext: () =>
        Promise.resolve({
          staffType: "coach",
          staffId: "hc-1",
          role: "HC",
          preferences: {
            marketTierPref: 50,
            philosophyFitPref: 50,
            staffFitPref: 50,
            compensationPref: 50,
            minimumThreshold: 40,
          },
          offense: null,
          defense: null,
        }),
      getFranchiseScoringProfile: (teamId) =>
        Promise.resolve({
          teamId,
          marketTier: "small",
          existingStaff: [],
        } as FranchiseScoringProfile),
    }),
    leagueRepo: stubLeagueRepo(),
    service,
    log: silentLog(),
  });

  await ai.executeNpcInterviews({
    leagueId: "lg",
    npcTeamIds: ["npc-a"],
    stepSlug: "hiring_interview_1",
  });

  assertEquals(calls.interviews.length, 0);
});

Deno.test("executeNpcInterviews: respects interviewsPerWeek cap across waves", async () => {
  const candidateIds = ["a", "b", "c"];
  const interests = candidateIds.map((id) =>
    makeInterest({
      teamId: "npc-a",
      staffType: "coach",
      staffId: id,
    })
  );

  const contexts: Record<string, CandidateScoringContext> = Object.fromEntries(
    candidateIds.map((id) => [
      id,
      {
        staffType: "coach",
        staffId: id,
        role: "HC",
        preferences: {
          marketTierPref: 50,
          philosophyFitPref: 50,
          staffFitPref: 50,
          compensationPref: 50,
          minimumThreshold: 40,
        },
        offense: null,
        defense: null,
      } as CandidateScoringContext,
    ]),
  );

  const { service, calls } = stubService();
  const ai = createNpcHiringAi({
    repo: stubRepo({
      listInterestsByTeam: () => Promise.resolve(interests),
      listInterviewsByTeam: () => Promise.resolve([]),
      getCandidateScoringContext: (_st, id) => Promise.resolve(contexts[id]),
      getFranchiseScoringProfile: (teamId) =>
        Promise.resolve({
          teamId,
          marketTier: "medium",
          existingStaff: [],
        } as FranchiseScoringProfile),
    }),
    leagueRepo: stubLeagueRepo({ ...defaultLeague, interviewsPerWeek: 2 }),
    service,
    log: silentLog(),
  });

  await ai.executeNpcInterviews({
    leagueId: "lg",
    npcTeamIds: ["npc-a"],
    stepSlug: "hiring_interview_1",
  });

  assertEquals(calls.interviews[0].targets.length, 2);
});

Deno.test("executeNpcOffers: submits a mid-band offer for each completed interview in priority order", async () => {
  const hcInterview = makeInterview({
    teamId: "npc-a",
    staffType: "coach",
    staffId: "hc-1",
    status: "completed",
    stepSlug: "hiring_interview_1",
  });
  const ocInterview = makeInterview({
    teamId: "npc-a",
    staffType: "coach",
    staffId: "oc-1",
    status: "completed",
    stepSlug: "hiring_interview_1",
  });
  const contexts: Record<string, CandidateScoringContext> = {
    "hc-1": {
      staffType: "coach",
      staffId: "hc-1",
      role: "HC",
      preferences: {
        marketTierPref: 50,
        philosophyFitPref: 50,
        staffFitPref: 50,
        compensationPref: 50,
        minimumThreshold: 40,
      },
      offense: null,
      defense: null,
    },
    "oc-1": {
      staffType: "coach",
      staffId: "oc-1",
      role: "OC",
      preferences: {
        marketTierPref: 50,
        philosophyFitPref: 50,
        staffFitPref: 50,
        compensationPref: 50,
        minimumThreshold: 40,
      },
      offense: null,
      defense: null,
    },
  };

  const { service, calls } = stubService();
  const ai = createNpcHiringAi({
    repo: stubRepo({
      listInterviewsByTeam: () => Promise.resolve([ocInterview, hcInterview]),
      listOffersByTeam: () => Promise.resolve([]),
      listSignedStaffByTeam: () => Promise.resolve([]),
      getCandidateScoringContext: (_st, id) => Promise.resolve(contexts[id]),
      getFranchiseScoringProfile: (teamId) =>
        Promise.resolve({
          teamId,
          marketTier: "medium",
          existingStaff: [],
        } as FranchiseScoringProfile),
      sumSignedStaffSalaries: () => Promise.resolve(0),
    }),
    leagueRepo: stubLeagueRepo({ ...defaultLeague, maxConcurrentOffers: 5 }),
    service,
    log: silentLog(),
  });

  await ai.executeNpcOffers({
    leagueId: "lg",
    npcTeamIds: ["npc-a"],
    stepSlug: "hiring_offers",
  });

  assertEquals(calls.offers.length, 1);
  const draft = calls.offers[0].offers;
  assertEquals(draft.length, 2);
  // HC first
  assertEquals(draft[0].staffId, "hc-1");
  // HC mid band is (5M + 20M) / 2 = 12.5M
  assertEquals(draft[0].salary, 12_500_000);
  assertEquals(draft[1].staffId, "oc-1");
  // OC mid band is (1.5M + 6M) / 2 = 3.75M
  assertEquals(draft[1].salary, 3_750_000);
});

Deno.test("executeNpcOffers: large-market teams offer above mid-band; small-market teams offer below", async () => {
  const hcInterview = makeInterview({
    teamId: "npc-a",
    staffType: "coach",
    staffId: "hc-1",
    status: "completed",
  });
  const context: CandidateScoringContext = {
    staffType: "coach",
    staffId: "hc-1",
    role: "HC",
    preferences: {
      marketTierPref: 50,
      philosophyFitPref: 50,
      staffFitPref: 50,
      compensationPref: 50,
      minimumThreshold: 40,
    },
    offense: null,
    defense: null,
  };

  async function offerFor(
    marketTier: "large" | "medium" | "small",
  ): Promise<number> {
    const { service, calls } = stubService();
    const ai = createNpcHiringAi({
      repo: stubRepo({
        listInterviewsByTeam: () => Promise.resolve([hcInterview]),
        listOffersByTeam: () => Promise.resolve([]),
        listSignedStaffByTeam: () => Promise.resolve([]),
        getCandidateScoringContext: () => Promise.resolve(context),
        getFranchiseScoringProfile: (teamId) =>
          Promise.resolve({
            teamId,
            marketTier,
            existingStaff: [],
          } as FranchiseScoringProfile),
        sumSignedStaffSalaries: () => Promise.resolve(0),
      }),
      leagueRepo: stubLeagueRepo(),
      service,
      log: silentLog(),
    });
    await ai.executeNpcOffers({
      leagueId: "lg",
      npcTeamIds: ["npc-a"],
      stepSlug: "hiring_offers",
    });
    return calls.offers[0].offers[0].salary;
  }

  const large = await offerFor("large");
  const medium = await offerFor("medium");
  const small = await offerFor("small");

  // HC band: 5M–20M. Mid = 12.5M. Large > medium > small.
  assertEquals(medium, 12_500_000);
  if (!(large > medium)) {
    throw new Error(`expected large (${large}) > medium (${medium})`);
  }
  if (!(small < medium)) {
    throw new Error(`expected small (${small}) < medium (${medium})`);
  }
});

Deno.test("executeNpcOffers: drops offers that would exceed the staff budget", async () => {
  const hcInterview = makeInterview({
    teamId: "npc-a",
    staffType: "coach",
    staffId: "hc-1",
    status: "completed",
  });
  const ocInterview = makeInterview({
    teamId: "npc-a",
    staffType: "coach",
    staffId: "oc-1",
    status: "completed",
  });
  const contexts: Record<string, CandidateScoringContext> = {
    "hc-1": {
      staffType: "coach",
      staffId: "hc-1",
      role: "HC",
      preferences: {
        marketTierPref: 50,
        philosophyFitPref: 50,
        staffFitPref: 50,
        compensationPref: 50,
        minimumThreshold: 40,
      },
      offense: null,
      defense: null,
    },
    "oc-1": {
      staffType: "coach",
      staffId: "oc-1",
      role: "OC",
      preferences: {
        marketTierPref: 50,
        philosophyFitPref: 50,
        staffFitPref: 50,
        compensationPref: 50,
        minimumThreshold: 40,
      },
      offense: null,
      defense: null,
    },
  };

  const { service, calls } = stubService();
  const ai = createNpcHiringAi({
    repo: stubRepo({
      listInterviewsByTeam: () => Promise.resolve([hcInterview, ocInterview]),
      listOffersByTeam: () => Promise.resolve([]),
      listSignedStaffByTeam: () => Promise.resolve([]),
      getCandidateScoringContext: (_st, id) => Promise.resolve(contexts[id]),
      getFranchiseScoringProfile: (teamId) =>
        Promise.resolve({
          teamId,
          marketTier: "medium",
          existingStaff: [],
        } as FranchiseScoringProfile),
      // Already 40M committed; HC mid = 12.5M → fits (52.5M would not, but
      // budget is 50M). So HC should be dropped, OC (3.75M) fits 43.75M.
      sumSignedStaffSalaries: () => Promise.resolve(40_000_000),
    }),
    leagueRepo: stubLeagueRepo({
      ...defaultLeague,
      staffBudget: 50_000_000,
      maxConcurrentOffers: 5,
    }),
    service,
    log: silentLog(),
  });

  await ai.executeNpcOffers({
    leagueId: "lg",
    npcTeamIds: ["npc-a"],
    stepSlug: "hiring_offers",
  });

  assertEquals(calls.offers.length, 1);
  const draft = calls.offers[0].offers;
  assertEquals(draft.length, 1);
  assertEquals(draft[0].staffId, "oc-1");
});

Deno.test("executeNpcOffers: respects maxConcurrentOffers minus existing pending offers", async () => {
  const interviews = ["a", "b", "c"].map((id) =>
    makeInterview({
      teamId: "npc-a",
      staffType: "coach",
      staffId: id,
      status: "completed",
    })
  );
  const contexts: Record<string, CandidateScoringContext> = Object.fromEntries(
    interviews.map((iv) => [
      iv.staffId,
      {
        staffType: "coach",
        staffId: iv.staffId,
        role: "HC",
        preferences: {
          marketTierPref: 50,
          philosophyFitPref: 50,
          staffFitPref: 50,
          compensationPref: 50,
          minimumThreshold: 40,
        },
        offense: null,
        defense: null,
      } as CandidateScoringContext,
    ]),
  );

  const { service, calls } = stubService();
  const ai = createNpcHiringAi({
    repo: stubRepo({
      listInterviewsByTeam: () => Promise.resolve(interviews),
      listOffersByTeam: () =>
        Promise.resolve([
          makeOffer({ teamId: "npc-a", status: "pending" }),
        ]),
      listSignedStaffByTeam: () => Promise.resolve([]),
      getCandidateScoringContext: (_st, id) => Promise.resolve(contexts[id]),
      getFranchiseScoringProfile: (teamId) =>
        Promise.resolve({
          teamId,
          marketTier: "medium",
          existingStaff: [],
        } as FranchiseScoringProfile),
      sumSignedStaffSalaries: () => Promise.resolve(0),
    }),
    leagueRepo: stubLeagueRepo({
      ...defaultLeague,
      maxConcurrentOffers: 2,
    }),
    service,
    log: silentLog(),
  });

  await ai.executeNpcOffers({
    leagueId: "lg",
    npcTeamIds: ["npc-a"],
    stepSlug: "hiring_offers",
  });

  // 2 cap minus 1 existing pending = 1 remaining slot.
  assertEquals(calls.offers[0].offers.length, 1);
});

Deno.test("executeNpcOffers: skips candidates that already have a pending offer from this team", async () => {
  const hcInterview = makeInterview({
    teamId: "npc-a",
    staffType: "coach",
    staffId: "hc-1",
    status: "completed",
  });
  const ocInterview = makeInterview({
    teamId: "npc-a",
    staffType: "coach",
    staffId: "oc-1",
    status: "completed",
  });
  const contexts: Record<string, CandidateScoringContext> = {
    "hc-1": {
      staffType: "coach",
      staffId: "hc-1",
      role: "HC",
      preferences: {
        marketTierPref: 50,
        philosophyFitPref: 50,
        staffFitPref: 50,
        compensationPref: 50,
        minimumThreshold: 40,
      },
      offense: null,
      defense: null,
    },
    "oc-1": {
      staffType: "coach",
      staffId: "oc-1",
      role: "OC",
      preferences: {
        marketTierPref: 50,
        philosophyFitPref: 50,
        staffFitPref: 50,
        compensationPref: 50,
        minimumThreshold: 40,
      },
      offense: null,
      defense: null,
    },
  };

  const { service, calls } = stubService();
  const ai = createNpcHiringAi({
    repo: stubRepo({
      listInterviewsByTeam: () => Promise.resolve([hcInterview, ocInterview]),
      listOffersByTeam: () =>
        Promise.resolve([
          makeOffer({
            teamId: "npc-a",
            staffType: "coach",
            staffId: "hc-1",
            status: "pending",
          }),
        ]),
      listSignedStaffByTeam: () => Promise.resolve([]),
      getCandidateScoringContext: (_st, id) => Promise.resolve(contexts[id]),
      getFranchiseScoringProfile: (teamId) =>
        Promise.resolve({
          teamId,
          marketTier: "medium",
          existingStaff: [],
        } as FranchiseScoringProfile),
      sumSignedStaffSalaries: () => Promise.resolve(0),
    }),
    leagueRepo: stubLeagueRepo({
      ...defaultLeague,
      maxConcurrentOffers: 5,
    }),
    service,
    log: silentLog(),
  });

  await ai.executeNpcOffers({
    leagueId: "lg",
    npcTeamIds: ["npc-a"],
    stepSlug: "hiring_offers",
  });

  const [submitted] = calls.offers;
  assertEquals(submitted.offers.length, 1);
  assertEquals(submitted.offers[0].staffId, "oc-1");
});

Deno.test("executeNpcOffers: handles coach and scout candidates in the same pass", async () => {
  const hcInterview = makeInterview({
    teamId: "npc-a",
    staffType: "coach",
    staffId: "hc-1",
    status: "completed",
  });
  const directorInterview = makeInterview({
    teamId: "npc-a",
    staffType: "scout",
    staffId: "dir-1",
    status: "completed",
  });
  const contexts: Record<string, CandidateScoringContext> = {
    "hc-1": {
      staffType: "coach",
      staffId: "hc-1",
      role: "HC",
      preferences: {
        marketTierPref: 50,
        philosophyFitPref: 50,
        staffFitPref: 50,
        compensationPref: 50,
        minimumThreshold: 40,
      },
      offense: null,
      defense: null,
    },
    "dir-1": {
      staffType: "scout",
      staffId: "dir-1",
      role: "DIRECTOR",
      preferences: {
        marketTierPref: 50,
        philosophyFitPref: 50,
        staffFitPref: 50,
        compensationPref: 50,
        minimumThreshold: 40,
      },
      offense: null,
      defense: null,
    },
  };

  const { service, calls } = stubService();
  const ai = createNpcHiringAi({
    repo: stubRepo({
      listInterviewsByTeam: () =>
        Promise.resolve([directorInterview, hcInterview]),
      listOffersByTeam: () => Promise.resolve([]),
      listSignedStaffByTeam: () => Promise.resolve([]),
      getCandidateScoringContext: (_staffType, id) =>
        Promise.resolve(contexts[id]),
      getFranchiseScoringProfile: (teamId) =>
        Promise.resolve({
          teamId,
          marketTier: "medium",
          existingStaff: [],
        } as FranchiseScoringProfile),
      sumSignedStaffSalaries: () => Promise.resolve(0),
    }),
    leagueRepo: stubLeagueRepo({ ...defaultLeague, maxConcurrentOffers: 5 }),
    service,
    log: silentLog(),
  });

  await ai.executeNpcOffers({
    leagueId: "lg",
    npcTeamIds: ["npc-a"],
    stepSlug: "hiring_offers",
  });

  const draft = calls.offers[0].offers;
  assertEquals(draft.length, 2);
  // HC (coach) ranks higher than DIRECTOR (scout).
  assertEquals(draft[0].staffType, "coach");
  assertEquals(draft[0].staffId, "hc-1");
  assertEquals(draft[1].staffType, "scout");
  assertEquals(draft[1].staffId, "dir-1");
  // Director mid band = (250K + 800K)/2 = 525K
  assertEquals(draft[1].salary, 525_000);
});
