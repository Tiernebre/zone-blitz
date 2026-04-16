import { assertEquals } from "@std/assert";
import {
  createLeagueClockRouter,
  type LeagueClockRouterDeps,
} from "./league-clock.router.ts";
import type {
  AdvanceResult,
  ClockState,
  LeagueClockService,
  VoteResult,
} from "./league-clock.service.ts";

function createMockClockState(
  overrides: Partial<ClockState> = {},
): ClockState {
  return {
    leagueId: "league-1",
    seasonYear: 2026,
    phase: "offseason_review",
    stepIndex: 0,
    slug: "awards_ceremony",
    kind: "event",
    flavorDate: null,
    advancedAt: new Date("2026-01-01T00:00:00Z"),
    hasCompletedInitial: true,
    ...overrides,
  };
}

function createMockAdvanceResult(
  overrides: Partial<AdvanceResult> = {},
): AdvanceResult {
  return {
    leagueId: "league-1",
    seasonYear: 2026,
    phase: "offseason_review",
    stepIndex: 1,
    slug: "end_of_year_recap",
    flavorDate: "Feb 10",
    advancedAt: new Date("2026-01-01T00:00:00Z"),
    overrideReason: null,
    overrideBlockers: null,
    autoResolved: [],
    looped: false,
    ...overrides,
  };
}

function createMockVoteResult(
  overrides: Partial<VoteResult> = {},
): VoteResult {
  return {
    leagueId: "league-1",
    teamId: "team-1",
    phase: "offseason_review",
    stepIndex: 0,
    readyAt: new Date("2026-04-15T00:00:00Z"),
    ...overrides,
  };
}

function createMockService(
  overrides: Partial<LeagueClockService> = {},
): LeagueClockService {
  return {
    getClockState: () => Promise.resolve(createMockClockState()),
    advance: () => Promise.resolve(createMockAdvanceResult()),
    castVote: () => Promise.resolve(createMockVoteResult()),
    ...overrides,
  };
}

function createMockDeps(
  overrides: Partial<LeagueClockRouterDeps> = {},
): LeagueClockRouterDeps {
  return {
    teamService: {
      getByLeagueId: () => Promise.resolve([]),
      getById: () => {
        throw new Error("not implemented");
      },
      createMany: () => {
        throw new Error("not implemented");
      },
    },
    coachesService: {
      generate: () => {
        throw new Error("not implemented");
      },
      generatePool: () => {
        throw new Error("not implemented");
      },
      getStaffTree: () => Promise.resolve([]),
      getCoachDetail: () => {
        throw new Error("not implemented");
      },
      getFingerprint: () => {
        throw new Error("not implemented");
      },
    },
    ...overrides,
  };
}

Deno.test("league-clock.router", async (t) => {
  await t.step("GET /:leagueId returns current clock state", async () => {
    const state = createMockClockState({
      phase: "regular_season",
      stepIndex: 3,
      slug: "week_4",
      kind: "week",
      flavorDate: "Oct 1",
    });
    const router = createLeagueClockRouter(
      createMockService({ getClockState: () => Promise.resolve(state) }),
      createMockDeps(),
    );

    const res = await router.request("/league-1");
    assertEquals(res.status, 200);

    const body = await res.json();
    assertEquals(body.phase, "regular_season");
    assertEquals(body.stepIndex, 3);
    assertEquals(body.slug, "week_4");
    assertEquals(body.kind, "week");
    assertEquals(body.flavorDate, "Oct 1");
    assertEquals(body.seasonYear, 2026);
  });

  await t.step(
    "GET /:leagueId passes leagueId param to service",
    async () => {
      let receivedId: string | undefined;
      const router = createLeagueClockRouter(
        createMockService({
          getClockState: (id) => {
            receivedId = id;
            return Promise.resolve(createMockClockState());
          },
        }),
        createMockDeps(),
      );

      await router.request("/my-league-id");
      assertEquals(receivedId, "my-league-id");
    },
  );

  await t.step(
    "POST /:leagueId/advance returns the advance result",
    async () => {
      const result = createMockAdvanceResult({
        phase: "coaching_carousel",
        stepIndex: 0,
      });
      const router = createLeagueClockRouter(
        createMockService({ advance: () => Promise.resolve(result) }),
        createMockDeps(),
      );

      const res = await router.request("/league-1/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isCommissioner: true,
          gateState: {
            teams: [],
            draftOrderResolved: true,
            superBowlPlayed: true,
            priorPhaseComplete: true,
          },
        }),
      });

      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.phase, "coaching_carousel");
      assertEquals(body.stepIndex, 0);
    },
  );

  await t.step(
    "POST /:leagueId/advance passes override reason to service",
    async () => {
      let receivedActor: unknown;
      const router = createLeagueClockRouter(
        createMockService({
          advance: (_id, actor) => {
            receivedActor = actor;
            return Promise.resolve(createMockAdvanceResult());
          },
        }),
        createMockDeps(),
      );

      await router.request("/league-1/advance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": "user-42",
        },
        body: JSON.stringify({
          isCommissioner: true,
          overrideReason: "Testing override",
          gateState: {
            teams: [],
            draftOrderResolved: true,
            superBowlPlayed: true,
            priorPhaseComplete: true,
          },
        }),
      });

      const actor = receivedActor as Record<string, unknown>;
      assertEquals(actor.isCommissioner, true);
      assertEquals(actor.overrideReason, "Testing override");
    },
  );

  await t.step(
    "POST /:leagueId/advance computes allTeamsHaveStaff server-side",
    async () => {
      let receivedGateState: unknown;
      const router = createLeagueClockRouter(
        createMockService({
          advance: (_id, _actor, gateState) => {
            receivedGateState = gateState;
            return Promise.resolve(createMockAdvanceResult());
          },
        }),
        createMockDeps({
          teamService: {
            getByLeagueId: () =>
              Promise.resolve([
                { id: "t-1", leagueId: "league-1", name: "Team 1" },
                { id: "t-2", leagueId: "league-1", name: "Team 2" },
              ] as import("@zone-blitz/shared").Team[]),
            getById: () => {
              throw new Error("not implemented");
            },
            createMany: () => {
              throw new Error("not implemented");
            },
          },
          coachesService: {
            generate: () => {
              throw new Error("not implemented");
            },
            generatePool: () => {
              throw new Error("not implemented");
            },
            getStaffTree: (_leagueId: string, teamId: string) =>
              Promise.resolve(
                teamId === "t-1"
                  ? [{ id: "c-1" } as import("@zone-blitz/shared").CoachNode]
                  : [{ id: "c-2" } as import("@zone-blitz/shared").CoachNode],
              ),
            getCoachDetail: () => {
              throw new Error("not implemented");
            },
            getFingerprint: () => {
              throw new Error("not implemented");
            },
          },
        }),
      );

      await router.request("/league-1/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isCommissioner: true,
          gateState: {
            teams: [],
            draftOrderResolved: true,
            superBowlPlayed: true,
            priorPhaseComplete: true,
          },
        }),
      });

      const gs = receivedGateState as Record<string, unknown>;
      assertEquals(gs.allTeamsHaveStaff, true);
    },
  );

  await t.step(
    "POST /:leagueId/advance sets allTeamsHaveStaff to false when a team has no staff",
    async () => {
      let receivedGateState: unknown;
      const router = createLeagueClockRouter(
        createMockService({
          advance: (_id, _actor, gateState) => {
            receivedGateState = gateState;
            return Promise.resolve(createMockAdvanceResult());
          },
        }),
        createMockDeps({
          teamService: {
            getByLeagueId: () =>
              Promise.resolve([
                { id: "t-1", leagueId: "league-1", name: "Team 1" },
                { id: "t-2", leagueId: "league-1", name: "Team 2" },
              ] as import("@zone-blitz/shared").Team[]),
            getById: () => {
              throw new Error("not implemented");
            },
            createMany: () => {
              throw new Error("not implemented");
            },
          },
          coachesService: {
            generate: () => {
              throw new Error("not implemented");
            },
            generatePool: () => {
              throw new Error("not implemented");
            },
            getStaffTree: (_leagueId: string, teamId: string) =>
              Promise.resolve(
                teamId === "t-1"
                  ? [{ id: "c-1" } as import("@zone-blitz/shared").CoachNode]
                  : [],
              ),
            getCoachDetail: () => {
              throw new Error("not implemented");
            },
            getFingerprint: () => {
              throw new Error("not implemented");
            },
          },
        }),
      );

      await router.request("/league-1/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isCommissioner: true,
          gateState: {
            teams: [],
            draftOrderResolved: true,
            superBowlPlayed: true,
            priorPhaseComplete: true,
          },
        }),
      });

      const gs = receivedGateState as Record<string, unknown>;
      assertEquals(gs.allTeamsHaveStaff, false);
    },
  );

  await t.step(
    "POST /:leagueId/votes casts a vote and returns 201",
    async () => {
      const teamId = crypto.randomUUID();
      const leagueId = crypto.randomUUID();
      let receivedLeagueId: string | undefined;
      let receivedTeamId: string | undefined;
      const voteResult = createMockVoteResult({
        leagueId,
        teamId,
        phase: "free_agency",
        stepIndex: 2,
      });
      const router = createLeagueClockRouter(
        createMockService({
          castVote: (lid, tid) => {
            receivedLeagueId = lid;
            receivedTeamId = tid;
            return Promise.resolve(voteResult);
          },
        }),
        createMockDeps(),
      );

      const res = await router.request(`/${leagueId}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });

      assertEquals(res.status, 201);
      const body = await res.json();
      assertEquals(body.leagueId, leagueId);
      assertEquals(body.teamId, teamId);
      assertEquals(body.phase, "free_agency");
      assertEquals(body.stepIndex, 2);
      assertEquals(receivedLeagueId, leagueId);
      assertEquals(receivedTeamId, teamId);
    },
  );

  await t.step(
    "POST /:leagueId/votes returns 400 when teamId is missing",
    async () => {
      const router = createLeagueClockRouter(
        createMockService(),
        createMockDeps(),
      );

      const res = await router.request("/lg-1/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      assertEquals(res.status, 400);
    },
  );

  await t.step(
    "POST /:leagueId/votes returns 400 when teamId is not a uuid",
    async () => {
      const router = createLeagueClockRouter(
        createMockService(),
        createMockDeps(),
      );

      const res = await router.request("/lg-1/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: "not-a-uuid" }),
      });

      assertEquals(res.status, 400);
    },
  );
});
