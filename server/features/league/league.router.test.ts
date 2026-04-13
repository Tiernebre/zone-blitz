import { assertEquals } from "@std/assert";
import { createLeagueRouter } from "./league.router.ts";
import type { League, LeagueService } from "@zone-blitz/shared";

function createMockLeague(overrides: Partial<League> = {}): League {
  return {
    id: "1",
    name: "Test",
    numberOfTeams: 32,
    seasonLength: 17,
    salaryCap: 255_000_000,
    capFloorPercent: 89,
    capGrowthRate: 5,
    rosterSize: 53,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockLeagueService(
  overrides: Partial<LeagueService> = {},
): LeagueService {
  return {
    getAll: () => Promise.resolve([]),
    getById: () => Promise.resolve(createMockLeague()),
    create: () => Promise.resolve(createMockLeague({ id: "new-id" })),
    deleteById: () => Promise.resolve(),
    ...overrides,
  };
}

Deno.test("league.router", async (t) => {
  await t.step("GET / returns all leagues", async () => {
    const leagues: League[] = [
      createMockLeague({ id: "1", name: "League One" }),
      createMockLeague({ id: "2", name: "League Two" }),
    ];
    const router = createLeagueRouter(
      createMockLeagueService({ getAll: () => Promise.resolve(leagues) }),
    );

    const res = await router.request("/");
    assertEquals(res.status, 200);

    const body = await res.json();
    assertEquals(body.length, 2);
    assertEquals(body[0].name, "League One");
    assertEquals(body[1].name, "League Two");
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

  await t.step("POST / creates a league and returns 201", async () => {
    const created = createMockLeague({ id: "new-id", name: "New League" });
    const router = createLeagueRouter(
      createMockLeagueService({ create: () => Promise.resolve(created) }),
    );

    const res = await router.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New League" }),
    });
    assertEquals(res.status, 201);

    const body = await res.json();
    assertEquals(body.id, "new-id");
    assertEquals(body.name, "New League");
  });

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
