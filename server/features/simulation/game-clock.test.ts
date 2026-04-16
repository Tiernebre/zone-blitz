import { assertEquals } from "@std/assert";
import type { PlayEvent, PlayTag } from "./events.ts";
import {
  formatClock,
  KNEEL_CLOCK_BURN,
  OT_SECONDS,
  QUARTER_SECONDS,
  SECONDS_PER_PLAY,
  shouldClockStop,
  shouldKneel,
  TIMEOUTS_PER_HALF,
  trySpendTimeout,
} from "./game-clock.ts";
import {
  createInitialState,
  type SimulationState,
} from "./game-state-manager.ts";

function makeState(
  overrides: Partial<SimulationState> = {},
): SimulationState {
  return createInitialState({
    kickoffYardLine: 35,
    ...overrides,
  });
}

function makeEvent(
  overrides: Partial<PlayEvent> = {},
): PlayEvent {
  return {
    gameId: "test",
    driveIndex: 0,
    playIndex: 0,
    quarter: 1,
    clock: "15:00",
    situation: { down: 1, distance: 10, yardLine: 35 },
    offenseTeamId: "team-home",
    defenseTeamId: "team-away",
    call: {
      concept: "dropback",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    },
    coverage: { front: "4-3", coverage: "cover_3", pressure: "none" },
    participants: [],
    outcome: "rush",
    yardage: 5,
    tags: [],
    ...overrides,
  };
}

Deno.test("game-clock", async (t) => {
  await t.step("constants have expected values", () => {
    assertEquals(QUARTER_SECONDS, 900);
    assertEquals(SECONDS_PER_PLAY, 34.8);
    assertEquals(OT_SECONDS, 600);
    assertEquals(TIMEOUTS_PER_HALF, 3);
    assertEquals(KNEEL_CLOCK_BURN, 40);
  });

  await t.step("formatClock", async (t) => {
    await t.step("formats full quarter", () => {
      assertEquals(formatClock(900), "15:00");
    });

    await t.step("formats zero", () => {
      assertEquals(formatClock(0), "0:00");
    });

    await t.step("formats mid-quarter time", () => {
      assertEquals(formatClock(125), "2:05");
    });

    await t.step("pads single-digit seconds", () => {
      assertEquals(formatClock(63), "1:03");
    });
  });

  await t.step("shouldClockStop", async (t) => {
    await t.step("returns true for incomplete pass", () => {
      assertEquals(
        shouldClockStop(makeEvent({ outcome: "pass_incomplete" })),
        true,
      );
    });

    await t.step("returns true for spike", () => {
      assertEquals(
        shouldClockStop(makeEvent({ outcome: "spike" })),
        true,
      );
    });

    await t.step("returns true for penalty tag", () => {
      assertEquals(
        shouldClockStop(makeEvent({ tags: ["penalty"] as PlayTag[] })),
        true,
      );
    });

    await t.step("returns true for turnover tag", () => {
      assertEquals(
        shouldClockStop(makeEvent({ tags: ["turnover"] as PlayTag[] })),
        true,
      );
    });

    await t.step("returns true for timeout tag", () => {
      assertEquals(
        shouldClockStop(makeEvent({ tags: ["timeout"] as PlayTag[] })),
        true,
      );
    });

    await t.step("returns true for touchdown", () => {
      assertEquals(
        shouldClockStop(makeEvent({ outcome: "touchdown" })),
        true,
      );
    });

    await t.step("returns true for field_goal", () => {
      assertEquals(
        shouldClockStop(makeEvent({ outcome: "field_goal" })),
        true,
      );
    });

    await t.step("returns true for missed_field_goal", () => {
      assertEquals(
        shouldClockStop(makeEvent({ outcome: "missed_field_goal" })),
        true,
      );
    });

    await t.step("returns true for punt", () => {
      assertEquals(
        shouldClockStop(makeEvent({ outcome: "punt" })),
        true,
      );
    });

    await t.step("returns true for kickoff", () => {
      assertEquals(
        shouldClockStop(makeEvent({ outcome: "kickoff" })),
        true,
      );
    });

    await t.step("returns true for safety", () => {
      assertEquals(
        shouldClockStop(makeEvent({ outcome: "safety" })),
        true,
      );
    });

    await t.step("returns true for return_td tag", () => {
      assertEquals(
        shouldClockStop(makeEvent({ tags: ["return_td"] as PlayTag[] })),
        true,
      );
    });

    await t.step("returns false for a normal rush", () => {
      assertEquals(
        shouldClockStop(makeEvent({ outcome: "rush", tags: [] })),
        false,
      );
    });

    await t.step("returns false for a completed pass", () => {
      assertEquals(
        shouldClockStop(makeEvent({ outcome: "pass_complete", tags: [] })),
        false,
      );
    });
  });

  await t.step("shouldKneel", async (t) => {
    await t.step("returns true in Q4 when leading with low clock", () => {
      const state = makeState({
        quarter: 4,
        clock: 100,
        homeScore: 21,
        awayScore: 14,
        possession: "home",
        down: 1,
      });
      assertEquals(shouldKneel(state), true);
    });

    await t.step("returns true in Q2 when leading with low clock", () => {
      const state = makeState({
        quarter: 2,
        clock: 80,
        homeScore: 14,
        awayScore: 7,
        possession: "home",
        down: 2,
      });
      assertEquals(shouldKneel(state), true);
    });

    await t.step("returns false in Q1", () => {
      const state = makeState({
        quarter: 1,
        clock: 80,
        homeScore: 14,
        awayScore: 7,
        possession: "home",
        down: 1,
      });
      assertEquals(shouldKneel(state), false);
    });

    await t.step("returns false in Q3", () => {
      const state = makeState({
        quarter: 3,
        clock: 80,
        homeScore: 14,
        awayScore: 7,
        possession: "home",
        down: 1,
      });
      assertEquals(shouldKneel(state), false);
    });

    await t.step("returns false when trailing", () => {
      const state = makeState({
        quarter: 4,
        clock: 80,
        homeScore: 7,
        awayScore: 14,
        possession: "home",
        down: 1,
      });
      assertEquals(shouldKneel(state), false);
    });

    await t.step("returns false when tied", () => {
      const state = makeState({
        quarter: 4,
        clock: 80,
        homeScore: 14,
        awayScore: 14,
        possession: "home",
        down: 1,
      });
      assertEquals(shouldKneel(state), false);
    });

    await t.step("returns false when too much clock remains", () => {
      const state = makeState({
        quarter: 4,
        clock: 500,
        homeScore: 21,
        awayScore: 14,
        possession: "home",
        down: 1,
      });
      assertEquals(shouldKneel(state), false);
    });

    await t.step("returns false when clock is zero", () => {
      const state = makeState({
        quarter: 4,
        clock: 0,
        homeScore: 21,
        awayScore: 14,
        possession: "home",
        down: 1,
      });
      assertEquals(shouldKneel(state), false);
    });

    await t.step("accounts for downs remaining", () => {
      // On 4th down, downsRemaining = 4-4+1 = 1, clockNeeded = 40
      const state = makeState({
        quarter: 4,
        clock: 40,
        homeScore: 21,
        awayScore: 14,
        possession: "home",
        down: 4,
      });
      assertEquals(shouldKneel(state), true);

      // On 1st down, downsRemaining = 4-1+1 = 4, clockNeeded = 160
      const state2 = makeState({
        quarter: 4,
        clock: 120,
        homeScore: 21,
        awayScore: 14,
        possession: "home",
        down: 1,
      });
      // 120 < 160, so shouldKneel = true
      assertEquals(shouldKneel(state2), true);

      // But with more clock, it won't kneel
      const state3 = makeState({
        quarter: 4,
        clock: 200,
        homeScore: 21,
        awayScore: 14,
        possession: "home",
        down: 1,
      });
      assertEquals(shouldKneel(state3), false);
    });

    await t.step("works for away team possession", () => {
      const state = makeState({
        quarter: 4,
        clock: 80,
        homeScore: 7,
        awayScore: 14,
        possession: "away",
        down: 1,
      });
      assertEquals(shouldKneel(state), true);
    });
  });

  await t.step("trySpendTimeout", async (t) => {
    await t.step("returns null outside two-minute drill", () => {
      const state = makeState({
        quarter: 2,
        clock: 300,
        homeScore: 7,
        awayScore: 14,
        possession: "home",
      });
      let callCount = 0;
      const rng = {
        next: () => {
          callCount++;
          return 0.1;
        },
        int: () => 0,
        pick: <T>(arr: readonly T[]): T => arr[0],
        gaussian: () => 0,
      };
      assertEquals(trySpendTimeout(state, rng), null);
      assertEquals(callCount, 0);
    });

    await t.step(
      "returns offense side when trailing in two-minute drill",
      () => {
        const state = makeState({
          quarter: 2,
          clock: 90,
          homeScore: 7,
          awayScore: 14,
          possession: "home",
          homeTimeouts: 3,
        });
        const rng = {
          next: () => 0.1, // < 0.4 threshold
          int: () => 0,
          pick: <T>(arr: readonly T[]): T => arr[0],
          gaussian: () => 0,
        };
        assertEquals(trySpendTimeout(state, rng), "home");
      },
    );

    await t.step(
      "returns null when rng roll is high",
      () => {
        const state = makeState({
          quarter: 4,
          clock: 90,
          homeScore: 7,
          awayScore: 14,
          possession: "home",
          homeTimeouts: 3,
          awayTimeouts: 3,
        });
        const rng = {
          next: () => 0.9, // > both thresholds
          int: () => 0,
          pick: <T>(arr: readonly T[]): T => arr[0],
          gaussian: () => 0,
        };
        assertEquals(trySpendTimeout(state, rng), null);
      },
    );

    await t.step(
      "returns offense side when trailing in two-minute drill (away possession)",
      () => {
        const state = makeState({
          quarter: 4,
          clock: 90,
          homeScore: 14,
          awayScore: 7,
          possession: "away",
          homeTimeouts: 3,
          awayTimeouts: 3,
        });
        let callIdx = 0;
        const rng = {
          next: () => {
            callIdx++;
            return callIdx === 1 ? 0.1 : 0.1;
          },
          int: () => 0,
          pick: <T>(arr: readonly T[]): T => arr[0],
          gaussian: () => 0,
        };
        // Away is trailing (7 < 14), so offense timeout side is returned
        assertEquals(trySpendTimeout(state, rng), "away");
      },
    );

    await t.step("returns null with 0 timeouts remaining", () => {
      const state = makeState({
        quarter: 4,
        clock: 90,
        homeScore: 7,
        awayScore: 14,
        possession: "home",
        homeTimeouts: 0,
        awayTimeouts: 0,
      });
      const rng = {
        next: () => 0.1,
        int: () => 0,
        pick: <T>(arr: readonly T[]): T => arr[0],
        gaussian: () => 0,
      };
      assertEquals(trySpendTimeout(state, rng), null);
    });
  });
});
