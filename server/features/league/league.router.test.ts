import { assertEquals } from "@std/assert";
import { createLeagueRouter } from "./league.router.ts";
import type { League, LeagueService } from "@zone-blitz/shared";

function createMockLeagueService(
  overrides: Partial<LeagueService> = {},
): LeagueService {
  return {
    getAll: () => Promise.resolve([]),
    getById: () =>
      Promise.resolve({
        id: "1",
        name: "Test",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    create: () =>
      Promise.resolve({
        id: "new-id",
        name: "Test",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ...overrides,
  };
}

Deno.test("league.router", async (t) => {
  await t.step("GET / returns all leagues", async () => {
    const leagues: League[] = [
      {
        id: "1",
        name: "League One",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "2",
        name: "League Two",
        createdAt: new Date(),
        updatedAt: new Date(),
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
    const league: League = {
      id: "42",
      name: "Found League",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
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
    const created: League = {
      id: "new-id",
      name: "New League",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
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
});
