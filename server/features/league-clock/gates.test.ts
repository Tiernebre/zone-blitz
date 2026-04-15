import { assertEquals } from "@std/assert";
import {
  enterDraftGate,
  enterOffseasonRolloverGate,
  enterRegularSeasonGate,
  getGateForPhase,
} from "./gates.ts";
import type { LeagueClockState, TeamClockState } from "./league-clock.types.ts";

function createTeam(
  overrides: Partial<TeamClockState> = {},
): TeamClockState {
  return {
    teamId: crypto.randomUUID(),
    isHuman: false,
    rosterCount: 53,
    totalCap: 200_000_000,
    ...overrides,
  };
}

function createState(
  overrides: Partial<LeagueClockState> = {},
): LeagueClockState {
  return {
    leagueId: crypto.randomUUID(),
    salaryCap: 255_000_000,
    rosterSize: 53,
    teams: [createTeam(), createTeam()],
    currentPhase: "preseason",
    currentStepIndex: 3,
    draftOrderResolved: true,
    superBowlPlayed: true,
    ...overrides,
  };
}

Deno.test("gates", async (t) => {
  await t.step("enterRegularSeasonGate", async (t) => {
    await t.step(
      "returns ok when all teams cap-compliant and at roster limit",
      () => {
        const state = createState({
          teams: [
            createTeam({ rosterCount: 53, totalCap: 200_000_000 }),
            createTeam({ rosterCount: 53, totalCap: 200_000_000 }),
          ],
        });
        const result = enterRegularSeasonGate(state);
        assertEquals(result, { ok: true });
      },
    );

    await t.step("blocks when a team is over the salary cap", () => {
      const overTeam = createTeam({
        teamId: "over-cap",
        totalCap: 300_000_000,
      });
      const state = createState({ teams: [overTeam, createTeam()] });
      const result = enterRegularSeasonGate(state);
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.blockers.length, 1);
        assertEquals(result.blockers[0].teamId, "over-cap");
        assertEquals(
          result.blockers[0].reason.includes("cap"),
          true,
        );
      }
    });

    await t.step("blocks when a team is not at roster limit", () => {
      const shortTeam = createTeam({ teamId: "short-roster", rosterCount: 50 });
      const state = createState({ teams: [shortTeam, createTeam()] });
      const result = enterRegularSeasonGate(state);
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.blockers.length, 1);
        assertEquals(result.blockers[0].teamId, "short-roster");
      }
    });

    await t.step("blocks when a team exceeds roster limit", () => {
      const overTeam = createTeam({ teamId: "over-roster", rosterCount: 60 });
      const state = createState({ teams: [overTeam, createTeam()] });
      const result = enterRegularSeasonGate(state);
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.blockers[0].teamId, "over-roster");
      }
    });

    await t.step(
      "returns multiple blockers for multiple non-compliant teams",
      () => {
        const team1 = createTeam({ teamId: "t1", totalCap: 300_000_000 });
        const team2 = createTeam({ teamId: "t2", rosterCount: 40 });
        const state = createState({ teams: [team1, team2] });
        const result = enterRegularSeasonGate(state);
        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.blockers.length, 2);
        }
      },
    );

    await t.step(
      "returns multiple blockers for same team with both violations",
      () => {
        const team = createTeam({
          teamId: "both-bad",
          totalCap: 300_000_000,
          rosterCount: 40,
        });
        const state = createState({ teams: [team, createTeam()] });
        const result = enterRegularSeasonGate(state);
        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.blockers.length, 2);
          assertEquals(
            result.blockers.every((b) => b.teamId === "both-bad"),
            true,
          );
        }
      },
    );
  });

  await t.step("enterDraftGate", async (t) => {
    await t.step("returns ok when draft order is resolved", () => {
      const state = createState({ draftOrderResolved: true });
      const result = enterDraftGate(state);
      assertEquals(result, { ok: true });
    });

    await t.step("blocks when draft order is not resolved", () => {
      const state = createState({ draftOrderResolved: false });
      const result = enterDraftGate(state);
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.blockers.length, 1);
        assertEquals(
          result.blockers[0].reason.includes("draft order"),
          true,
        );
      }
    });
  });

  await t.step("enterOffseasonRolloverGate", async (t) => {
    await t.step("returns ok when super bowl has been played", () => {
      const state = createState({ superBowlPlayed: true });
      const result = enterOffseasonRolloverGate(state);
      assertEquals(result, { ok: true });
    });

    await t.step("blocks when super bowl has not been played", () => {
      const state = createState({ superBowlPlayed: false });
      const result = enterOffseasonRolloverGate(state);
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.blockers.length, 1);
        assertEquals(
          result.blockers[0].reason.includes("Super Bowl"),
          true,
        );
      }
    });
  });

  await t.step("getGateForPhase", async (t) => {
    await t.step("returns enterRegularSeasonGate for regular_season", () => {
      const gate = getGateForPhase("regular_season");
      assertEquals(gate, enterRegularSeasonGate);
    });

    await t.step("returns enterDraftGate for draft", () => {
      const gate = getGateForPhase("draft");
      assertEquals(gate, enterDraftGate);
    });

    await t.step(
      "returns enterOffseasonRolloverGate for offseason_rollover",
      () => {
        const gate = getGateForPhase("offseason_rollover");
        assertEquals(gate, enterOffseasonRolloverGate);
      },
    );

    await t.step("returns undefined for ungated phases", () => {
      assertEquals(getGateForPhase("free_agency"), undefined);
      assertEquals(getGateForPhase("preseason"), undefined);
      assertEquals(getGateForPhase("offseason_review"), undefined);
    });
  });
});
