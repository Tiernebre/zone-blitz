import { assertEquals } from "@std/assert";
import { DomainError } from "@zone-blitz/shared";
import type { ScoutDetail, ScoutNode } from "@zone-blitz/shared";
import { createScoutsRouter } from "./scouts.router.ts";
import type { ScoutsService } from "./scouts.service.interface.ts";

function createMockService(
  overrides: Partial<ScoutsService> = {},
): ScoutsService {
  return {
    generate: () => Promise.resolve({ scoutCount: 0 }),
    getStaffTree: () => Promise.resolve([]),
    getScoutDetail: () =>
      Promise.reject(new DomainError("NOT_FOUND", "Scout missing not found")),
    ...overrides,
  };
}

function createNode(overrides: Partial<ScoutNode> = {}): ScoutNode {
  return {
    id: "s1",
    firstName: "Alex",
    lastName: "Stone",
    role: "DIRECTOR",
    reportsToId: null,
    coverage: null,
    age: 55,
    yearsWithTeam: 3,
    contractYearsRemaining: 4,
    workCapacity: 200,
    isVacancy: false,
    ...overrides,
  };
}

function createDetail(overrides: Partial<ScoutDetail> = {}): ScoutDetail {
  return {
    id: "s1",
    leagueId: "l1",
    teamId: "t1",
    firstName: "Alex",
    lastName: "Stone",
    role: "DIRECTOR",
    coverage: null,
    age: 55,
    yearsWithTeam: 3,
    contractYearsRemaining: 4,
    contractSalary: 1_500_000,
    contractBuyout: 2_000_000,
    workCapacity: 200,
    isVacancy: false,
    reputationLabels: [],
    careerStops: [],
    evaluations: [],
    crossChecks: [],
    externalTrackRecord: [],
    connections: [],
    ...overrides,
  };
}

Deno.test("scouts.router", async (t) => {
  await t.step(
    "GET /leagues/:leagueId/teams/:teamId/staff returns the staff tree",
    async () => {
      let receivedLeague: string | undefined;
      let receivedTeam: string | undefined;
      const nodes = [
        createNode({ id: "dir", role: "DIRECTOR" }),
        createNode({
          id: "cc",
          role: "NATIONAL_CROSS_CHECKER",
          reportsToId: "dir",
        }),
      ];
      const router = createScoutsRouter(
        createMockService({
          getStaffTree: (leagueId, teamId) => {
            receivedLeague = leagueId;
            receivedTeam = teamId;
            return Promise.resolve(nodes);
          },
        }),
      );

      const res = await router.request(
        "/leagues/league-1/teams/team-123/staff",
      );
      assertEquals(res.status, 200);
      assertEquals(receivedLeague, "league-1");
      assertEquals(receivedTeam, "team-123");

      const body = await res.json();
      assertEquals(body.length, 2);
      assertEquals(body[0].id, "dir");
    },
  );

  await t.step("GET /:scoutId returns the scout detail", async () => {
    let received: string | undefined;
    const detail = createDetail({ id: "scout-42", firstName: "Sam" });
    const router = createScoutsRouter(
      createMockService({
        getScoutDetail: (id) => {
          received = id;
          return Promise.resolve(detail);
        },
      }),
    );

    const res = await router.request("/scout-42");
    assertEquals(res.status, 200);
    assertEquals(received, "scout-42");

    const body = await res.json();
    assertEquals(body.id, "scout-42");
    assertEquals(body.firstName, "Sam");
  });
});
