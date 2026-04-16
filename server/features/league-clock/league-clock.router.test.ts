import { assertEquals } from "@std/assert";
import { createLeagueClockRouter } from "./league-clock.router.ts";
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
    hasCompletedGenesis: true,
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

const stubResolveStaff = () => Promise.resolve(true);

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
      stubResolveStaff,
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
        stubResolveStaff,
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
        stubResolveStaff,
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
        stubResolveStaff,
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
    "POST /:leagueId/advance merges server-computed allTeamsHaveStaff into gate state",
    async () => {
      let receivedGateState: unknown;
      const router = createLeagueClockRouter(
        createMockService({
          advance: (_id, _actor, gateState) => {
            receivedGateState = gateState;
            return Promise.resolve(createMockAdvanceResult());
          },
        }),
        () => Promise.resolve(false),
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
            allTeamsHaveStaff: true,
          },
        }),
      });

      const gs = receivedGateState as Record<string, unknown>;
      assertEquals(
        gs.allTeamsHaveStaff,
        false,
        "server-computed value should override client-sent value",
      );
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
        stubResolveStaff,
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
        stubResolveStaff,
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
        stubResolveStaff,
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
