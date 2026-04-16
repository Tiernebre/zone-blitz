import { assertEquals } from "@std/assert";
import { createTeamRouter } from "./team.router.ts";
import type { Team } from "@zone-blitz/shared";
import type { TeamService } from "./team.service.interface.ts";

function createMockTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: "1",
    leagueId: "league-1",
    franchiseId: "franchise-1",
    name: "Test Team",
    cityId: "city-1",
    city: "Test City",
    state: "NY",
    abbreviation: "TST",
    primaryColor: "#000000",
    secondaryColor: "#FFFFFF",
    accentColor: "#FF0000",
    backstory: "A test franchise backstory.",
    conference: "AFC",
    division: "AFC East",
    marketTier: "medium",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockTeamService(
  overrides: Partial<TeamService> = {},
): TeamService {
  return {
    getByLeagueId: () => Promise.resolve([]),
    getById: () => Promise.resolve(createMockTeam()),
    createMany: () => Promise.resolve([]),
    ...overrides,
  };
}

Deno.test("team.router", async (t) => {
  await t.step("GET /league/:leagueId returns teams for league", async () => {
    const teams = [
      createMockTeam({ id: "1", name: "Team A" }),
      createMockTeam({ id: "2", name: "Team B" }),
    ];
    const router = createTeamRouter(
      createMockTeamService({
        getByLeagueId: () => Promise.resolve(teams),
      }),
    );

    const res = await router.request("/league/league-1");
    assertEquals(res.status, 200);

    const body = await res.json();
    assertEquals(body.length, 2);
    assertEquals(body[0].name, "Team A");
    assertEquals(body[1].name, "Team B");
  });

  await t.step(
    "GET /league/:leagueId returns empty array when no teams",
    async () => {
      const router = createTeamRouter(createMockTeamService());

      const res = await router.request("/league/league-1");
      assertEquals(res.status, 200);

      const body = await res.json();
      assertEquals(body.length, 0);
    },
  );

  await t.step("GET /:id returns the team", async () => {
    const team = createMockTeam({ id: "42", name: "Found" });
    const router = createTeamRouter(
      createMockTeamService({ getById: () => Promise.resolve(team) }),
    );

    const res = await router.request("/42");
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.id, "42");
    assertEquals(body.name, "Found");
  });
});
