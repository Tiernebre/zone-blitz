import { assertEquals } from "@std/assert";
import { createLeagueClockRouter } from "./league-clock.router.ts";
import type { LeagueClockService, VoteResult } from "./league-clock.service.ts";

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
    advance: () =>
      Promise.resolve({
        leagueId: "league-1",
        seasonYear: 2026,
        phase: "offseason_review",
        stepIndex: 1,
        advancedAt: new Date(),
        overrideReason: null,
        overrideBlockers: null,
        autoResolved: [],
        looped: false,
      }),
    castVote: () => Promise.resolve(createMockVoteResult()),
    ...overrides,
  };
}

Deno.test("league-clock.router", async (t) => {
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
      const router = createLeagueClockRouter(createMockService());

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
      const router = createLeagueClockRouter(createMockService());

      const res = await router.request("/lg-1/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: "not-a-uuid" }),
      });

      assertEquals(res.status, 400);
    },
  );
});
