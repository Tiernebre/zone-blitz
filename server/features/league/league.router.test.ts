import { assertEquals } from "@std/assert";
import { createLeagueRouter } from "./league.router.ts";
import type { League, LeagueListItem, Team } from "@zone-blitz/shared";
import type {
  CreateLeagueResult,
  LeagueService,
} from "./league.service.interface.ts";

function createMockLeague(overrides: Partial<League> = {}): League {
  return {
    id: "1",
    name: "Test",
    userTeamId: null,
    numberOfTeams: 8,
    seasonLength: 10,
    salaryCap: 255_000_000,
    capFloorPercent: 89,
    capGrowthRate: 5,
    rosterSize: 53,
    advancePolicy: "commissioner",
    staffBudget: 50_000_000,
    interestCap: 10,
    interviewsPerWeek: 4,
    maxConcurrentOffers: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastPlayedAt: null,
    ...overrides,
  };
}

function createMockTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: "team-1",
    leagueId: "1",
    franchiseId: "f-1",
    name: "Team",
    cityId: "city-1",
    city: "City",
    state: "NY",
    abbreviation: "TST",
    primaryColor: "#000",
    secondaryColor: "#FFF",
    accentColor: "#F00",
    backstory: "A test franchise backstory.",
    conference: "AFC",
    division: "AFC East",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockLeagueService(
  overrides: Partial<LeagueService> = {},
): LeagueService {
  const defaultResult: CreateLeagueResult = {
    league: createMockLeague({ id: "new-id" }),
    teams: Array.from({ length: 8 }, (_, i) =>
      createMockTeam({
        id: `team-${i + 1}`,
        leagueId: "new-id",
        franchiseId: `f-${i + 1}`,
      })),
  };

  return {
    getAll: () => Promise.resolve([]),
    getById: () => Promise.resolve(createMockLeague()),
    create: () => Promise.resolve(defaultResult),
    found: () =>
      Promise.resolve({
        leagueId: "lg-1",
        seasonId: "s-1",
        playerCount: 50,
        coachCount: 10,
        scoutCount: 5,
      }),
    getTeams: () => Promise.resolve([]),
    assignUserTeam: () => Promise.resolve(createMockLeague()),
    touchLastPlayed: () => Promise.resolve(createMockLeague()),
    deleteById: () => Promise.resolve(),
    ...overrides,
  };
}

Deno.test("league.router", async (t) => {
  await t.step("GET / returns all leagues with current season", async () => {
    const leagues: LeagueListItem[] = [
      {
        ...createMockLeague({ id: "1", name: "League One" }),
        currentSeason: {
          year: 1,
          phase: "preseason",
          offseasonStage: null,
          week: 1,
        },
        userTeam: null,
      },
      {
        ...createMockLeague({ id: "2", name: "League Two" }),
        currentSeason: null,
        userTeam: null,
      },
    ];
    const router = createLeagueRouter(
      createMockLeagueService({ getAll: () => Promise.resolve(leagues) }),
    );

    const res = await router.request("/");
    assertEquals(res.status, 200);

    const body = await res.json();
    assertEquals(body.length, 2);
    assertEquals(body[0].name, "League One");
    assertEquals(body[0].currentSeason, {
      year: 1,
      phase: "preseason",
      offseasonStage: null,
      week: 1,
    });
    assertEquals(body[1].currentSeason, null);
  });

  await t.step("GET / returns empty array when no leagues", async () => {
    const router = createLeagueRouter(createMockLeagueService());

    const res = await router.request("/");
    assertEquals(res.status, 200);

    const body = await res.json();
    assertEquals(body.length, 0);
  });

  await t.step("GET /:id returns a league by id", async () => {
    const league = createMockLeague({ id: "42", name: "Found League" });
    const router = createLeagueRouter(
      createMockLeagueService({ getById: () => Promise.resolve(league) }),
    );

    const res = await router.request("/42");
    assertEquals(res.status, 200);

    const body = await res.json();
    assertEquals(body.id, "42");
    assertEquals(body.name, "Found League");
  });

  await t.step(
    "POST / creates a league shell with teams and returns 201",
    async () => {
      const result: CreateLeagueResult = {
        league: createMockLeague({ id: "new-id", name: "New League" }),
        teams: Array.from({ length: 8 }, (_, i) =>
          createMockTeam({
            id: `team-${i + 1}`,
            leagueId: "new-id",
            franchiseId: `f-${i + 1}`,
          })),
      };
      const router = createLeagueRouter(
        createMockLeagueService({ create: () => Promise.resolve(result) }),
      );

      const res = await router.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New League" }),
      });
      assertEquals(res.status, 201);

      const body = await res.json();
      assertEquals(body.league.id, "new-id");
      assertEquals(body.league.name, "New League");
      assertEquals(body.teams.length, 8);
    },
  );

  await t.step("POST / returns 400 when name is missing", async () => {
    const router = createLeagueRouter(createMockLeagueService());

    const res = await router.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assertEquals(res.status, 400);
  });

  await t.step("POST / returns 400 when name is empty string", async () => {
    const router = createLeagueRouter(createMockLeagueService());

    const res = await router.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    assertEquals(res.status, 400);
  });

  await t.step(
    "POST / returns 400 when name exceeds 100 characters",
    async () => {
      const router = createLeagueRouter(createMockLeagueService());

      const res = await router.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "a".repeat(101) }),
      });
      assertEquals(res.status, 400);
    },
  );

  await t.step("GET /:id/teams returns teams for the league", async () => {
    const teams = [
      createMockTeam({ id: "team-1", name: "Alpha" }),
      createMockTeam({ id: "team-2", name: "Beta" }),
    ];
    const router = createLeagueRouter(
      createMockLeagueService({ getTeams: () => Promise.resolve(teams) }),
    );

    const res = await router.request("/lg-1/teams");
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.length, 2);
    assertEquals(body[0].name, "Alpha");
    assertEquals(body[1].name, "Beta");
  });

  await t.step(
    "POST /:id/found runs founding generation and returns result",
    async () => {
      let foundLeagueId: string | undefined;
      const router = createLeagueRouter(
        createMockLeagueService({
          found: (leagueId) => {
            foundLeagueId = leagueId;
            return Promise.resolve({
              leagueId,
              seasonId: "s-1",
              playerCount: 50,
              coachCount: 10,
              scoutCount: 5,
            });
          },
        }),
      );

      const res = await router.request("/lg-1/found", { method: "POST" });
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.leagueId, "lg-1");
      assertEquals(body.seasonId, "s-1");
      assertEquals(body.playerCount, 50);
      assertEquals(foundLeagueId, "lg-1");
    },
  );

  await t.step(
    "PATCH /:id/user-team assigns the user team and returns the league",
    async () => {
      let received: { leagueId?: string; userTeamId?: string } = {};
      const teamId = crypto.randomUUID();
      const updated = createMockLeague({ id: "lg-1", userTeamId: teamId });
      const router = createLeagueRouter(
        createMockLeagueService({
          assignUserTeam: (leagueId, userTeamId) => {
            received = { leagueId, userTeamId };
            return Promise.resolve(updated);
          },
        }),
      );

      const res = await router.request("/lg-1/user-team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userTeamId: teamId }),
      });
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.userTeamId, teamId);
      assertEquals(received.leagueId, "lg-1");
      assertEquals(received.userTeamId, teamId);
    },
  );

  await t.step(
    "PATCH /:id/user-team returns 400 when userTeamId is not a uuid",
    async () => {
      const router = createLeagueRouter(createMockLeagueService());

      const res = await router.request("/lg-1/user-team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userTeamId: "not-a-uuid" }),
      });
      assertEquals(res.status, 400);
    },
  );

  await t.step(
    "POST /:id/touch updates last played and returns the league",
    async () => {
      let touchedId: string | undefined;
      const touchedAt = new Date("2026-04-14T00:00:00Z");
      const router = createLeagueRouter(
        createMockLeagueService({
          touchLastPlayed: (id) => {
            touchedId = id;
            return Promise.resolve(
              createMockLeague({ id, lastPlayedAt: touchedAt }),
            );
          },
        }),
      );

      const res = await router.request("/lg-1/touch", { method: "POST" });
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.id, "lg-1");
      assertEquals(touchedId, "lg-1");
      assertEquals(body.lastPlayedAt, touchedAt.toISOString());
    },
  );

  await t.step("DELETE /:id deletes a league and returns 204", async () => {
    let deletedId: string | undefined;
    const router = createLeagueRouter(
      createMockLeagueService({
        deleteById: (id) => {
          deletedId = id;
          return Promise.resolve();
        },
      }),
    );

    const res = await router.request("/some-uuid", { method: "DELETE" });
    assertEquals(res.status, 204);
    assertEquals(deletedId, "some-uuid");
  });
});
