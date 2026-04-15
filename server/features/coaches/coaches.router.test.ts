import { assertEquals } from "@std/assert";
import { DomainError } from "@zone-blitz/shared";
import type { CoachDetail, CoachNode } from "@zone-blitz/shared";
import { createCoachesRouter } from "./coaches.router.ts";
import type { CoachesService } from "./coaches.service.interface.ts";

function createMockService(
  overrides: Partial<CoachesService> = {},
): CoachesService {
  return {
    generate: () => Promise.resolve({ coachCount: 0 }),
    generatePool: () => Promise.resolve({ coachCount: 0 }),
    getStaffTree: () => Promise.resolve([]),
    getCoachDetail: () =>
      Promise.reject(new DomainError("NOT_FOUND", "Coach missing not found")),
    getFingerprint: () =>
      Promise.resolve({ offense: null, defense: null, overrides: {} }),
    ...overrides,
  };
}

function createNode(overrides: Partial<CoachNode> = {}): CoachNode {
  return {
    id: "c1",
    firstName: "Alex",
    lastName: "Stone",
    role: "HC",
    reportsToId: null,
    playCaller: "offense",
    specialty: "ceo",
    age: 52,
    yearsWithTeam: 3,
    contractYearsRemaining: 4,
    isVacancy: false,
    ...overrides,
  };
}

function createDetail(overrides: Partial<CoachDetail> = {}): CoachDetail {
  return {
    id: "c1",
    leagueId: "l1",
    teamId: "t1",
    firstName: "Alex",
    lastName: "Stone",
    role: "HC",
    specialty: "ceo",
    playCaller: "offense",
    age: 52,
    yearsWithTeam: 3,
    contractYearsRemaining: 4,
    contractSalary: 10_000_000,
    contractBuyout: 20_000_000,
    isVacancy: false,
    college: null,
    mentor: null,
    reputationLabels: [],
    careerStops: [],
    tenureUnitPerformance: [],
    tenurePlayerDev: [],
    accolades: [],
    depthChartNotes: [],
    connections: [],
    ...overrides,
  };
}

Deno.test("coaches.router", async (t) => {
  await t.step(
    "GET /leagues/:leagueId/teams/:teamId/staff returns the staff tree",
    async () => {
      let receivedLeague: string | undefined;
      let receivedTeam: string | undefined;
      const nodes = [
        createNode({ id: "hc", role: "HC" }),
        createNode({ id: "oc", role: "OC", reportsToId: "hc" }),
      ];
      const router = createCoachesRouter(
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
      assertEquals(body[0].id, "hc");
    },
  );

  await t.step(
    "GET /leagues/:leagueId/teams/:teamId/fingerprint returns the computed fingerprint",
    async () => {
      let receivedLeague: string | undefined;
      let receivedTeam: string | undefined;
      const router = createCoachesRouter(
        createMockService({
          getFingerprint: (leagueId, teamId) => {
            receivedLeague = leagueId;
            receivedTeam = teamId;
            return Promise.resolve({
              offense: {
                runPassLean: 40,
                tempo: 60,
                personnelWeight: 50,
                formationUnderCenterShotgun: 30,
                preSnapMotionRate: 80,
                passingStyle: 30,
                passingDepth: 45,
                runGameBlocking: 25,
                rpoIntegration: 30,
              },
              defense: null,
              overrides: {},
            });
          },
        }),
      );

      const res = await router.request(
        "/leagues/league-9/teams/team-17/fingerprint",
      );
      assertEquals(res.status, 200);
      assertEquals(receivedLeague, "league-9");
      assertEquals(receivedTeam, "team-17");
      const body = await res.json();
      assertEquals(body.offense.tempo, 60);
      assertEquals(body.defense, null);
    },
  );

  await t.step("GET /:coachId returns the coach detail", async () => {
    let received: string | undefined;
    const detail = createDetail({ id: "coach-42", firstName: "Sam" });
    const router = createCoachesRouter(
      createMockService({
        getCoachDetail: (id) => {
          received = id;
          return Promise.resolve(detail);
        },
      }),
    );

    const res = await router.request("/coach-42");
    assertEquals(res.status, 200);
    assertEquals(received, "coach-42");

    const body = await res.json();
    assertEquals(body.id, "coach-42");
    assertEquals(body.firstName, "Sam");
  });
});
