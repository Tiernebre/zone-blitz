import { assertEquals } from "@std/assert";
import { DomainError, type PlayerDetail } from "@zone-blitz/shared";
import { createPlayersRouter } from "./players.router.ts";
import type { PlayersService } from "./players.service.interface.ts";

function createMockService(
  overrides: Partial<PlayersService> = {},
): PlayersService {
  return {
    generate: () =>
      Promise.resolve({
        playerCount: 0,
        draftProspectCount: 0,
        contractCount: 0,
      }),
    getDetail: () =>
      Promise.reject(new DomainError("NOT_FOUND", "player not found")),
    ...overrides,
  };
}

Deno.test("players.router", async (t) => {
  await t.step("GET /:playerId returns the player detail", async () => {
    let receivedId: string | undefined;
    const detail: PlayerDetail = {
      id: "p1",
      firstName: "Sam",
      lastName: "Stone",
      position: "QB",
      age: 28,
      heightInches: 74,
      weightPounds: 225,
      yearsOfExperience: 5,
      injuryStatus: "healthy",
      currentTeam: {
        id: "t1",
        name: "Bengals",
        city: "Cincinnati",
        abbreviation: "CIN",
      },
      origin: {
        draftYear: 2020,
        draftRound: 1,
        draftPick: 1,
        draftingTeam: {
          id: "t1",
          name: "Bengals",
          city: "Cincinnati",
          abbreviation: "CIN",
        },
        college: "State University",
        hometown: "Dallas, TX",
      },
    };

    const router = createPlayersRouter(
      createMockService({
        getDetail: (id) => {
          receivedId = id;
          return Promise.resolve(detail);
        },
      }),
    );

    const res = await router.request("/p1");
    assertEquals(res.status, 200);
    assertEquals(receivedId, "p1");
    const body = await res.json();
    assertEquals(body.id, "p1");
    assertEquals(body.origin.draftRound, 1);
  });
});
