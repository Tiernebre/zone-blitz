import { assertEquals } from "@std/assert";
import { createTeamRouter } from "./team.router.ts";
import type { Team, TeamRepository } from "@zone-blitz/shared";

function createMockTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: "1",
    name: "Test Team",
    city: "Test City",
    abbreviation: "TST",
    primaryColor: "#000000",
    secondaryColor: "#FFFFFF",
    accentColor: "#FF0000",
    conference: "AFC",
    division: "AFC East",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockTeamRepo(
  overrides: Partial<TeamRepository> = {},
): TeamRepository {
  return {
    getAll: () => Promise.resolve([]),
    getById: () => Promise.resolve(undefined),
    ...overrides,
  };
}

Deno.test("team.router", async (t) => {
  await t.step("GET / returns all teams", async () => {
    const teams = [
      createMockTeam({ id: "1", name: "Team A" }),
      createMockTeam({ id: "2", name: "Team B" }),
    ];
    const router = createTeamRouter(
      createMockTeamRepo({ getAll: () => Promise.resolve(teams) }),
    );

    const res = await router.request("/");
    assertEquals(res.status, 200);

    const body = await res.json();
    assertEquals(body.length, 2);
    assertEquals(body[0].name, "Team A");
    assertEquals(body[1].name, "Team B");
  });

  await t.step("GET / returns empty array when no teams", async () => {
    const router = createTeamRouter(createMockTeamRepo());

    const res = await router.request("/");
    assertEquals(res.status, 200);

    const body = await res.json();
    assertEquals(body.length, 0);
  });
});
