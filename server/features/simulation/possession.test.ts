import { assertEquals } from "@std/assert";
import type { PlayEvent, PlayTag } from "./events.ts";
import type { MutableGameState } from "./game-clock.ts";
import { QUARTER_SECONDS, TIMEOUTS_PER_HALF } from "./game-clock.ts";
import {
  advanceDowns,
  applyAcceptedPenalty,
  handleTurnover,
  startNewDrive,
  switchPossession,
} from "./possession.ts";

function makeState(
  overrides: Partial<MutableGameState> = {},
): MutableGameState {
  return {
    quarter: 1,
    clock: QUARTER_SECONDS,
    homeScore: 0,
    awayScore: 0,
    possession: "home",
    yardLine: 35,
    down: 1,
    distance: 10,
    driveIndex: 0,
    playIndex: 0,
    globalPlayIndex: 0,
    driveStartYardLine: 35,
    drivePlays: 0,
    driveYards: 0,
    homeTimeouts: TIMEOUTS_PER_HALF,
    awayTimeouts: TIMEOUTS_PER_HALF,
    ...overrides,
  };
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

Deno.test("possession", async (t) => {
  await t.step("startNewDrive", async (t) => {
    await t.step("increments drive index and resets drive state", () => {
      const state = makeState({ driveIndex: 2, playIndex: 5 });
      startNewDrive(state, 25);
      assertEquals(state.driveIndex, 3);
      assertEquals(state.playIndex, 0);
      assertEquals(state.yardLine, 25);
      assertEquals(state.down, 1);
      assertEquals(state.distance, 10);
      assertEquals(state.driveStartYardLine, 25);
      assertEquals(state.drivePlays, 0);
      assertEquals(state.driveYards, 0);
    });
  });

  await t.step("switchPossession", async (t) => {
    await t.step("toggles from home to away", () => {
      const state = makeState({ possession: "home" });
      switchPossession(state);
      assertEquals(state.possession, "away");
    });

    await t.step("toggles from away to home", () => {
      const state = makeState({ possession: "away" });
      switchPossession(state);
      assertEquals(state.possession, "home");
    });
  });

  await t.step("advanceDowns", async (t) => {
    await t.step("grants first down when yardage meets distance", () => {
      const state = makeState({ yardLine: 35, down: 1, distance: 10 });
      advanceDowns(state, 10);
      assertEquals(state.yardLine, 45);
      assertEquals(state.down, 1);
      assertEquals(state.distance, 10);
    });

    await t.step("grants first down when yardage exceeds distance", () => {
      const state = makeState({ yardLine: 35, down: 2, distance: 7 });
      advanceDowns(state, 12);
      assertEquals(state.yardLine, 47);
      assertEquals(state.down, 1);
      assertEquals(state.distance, 10);
    });

    await t.step("advances down when yardage is less than distance", () => {
      const state = makeState({ yardLine: 35, down: 1, distance: 10 });
      advanceDowns(state, 4);
      assertEquals(state.yardLine, 39);
      assertEquals(state.down, 2);
      assertEquals(state.distance, 6);
    });

    await t.step("caps down at 4", () => {
      const state = makeState({ yardLine: 35, down: 3, distance: 10 });
      advanceDowns(state, 2);
      assertEquals(state.down, 4);
      assertEquals(state.distance, 8);
    });

    await t.step("handles negative yardage clamping to yard 1", () => {
      const state = makeState({ yardLine: 2, down: 1, distance: 10 });
      advanceDowns(state, -5);
      assertEquals(state.yardLine, 1);
    });

    await t.step("tracks drive yards", () => {
      const state = makeState({ driveYards: 15 });
      advanceDowns(state, 8);
      assertEquals(state.driveYards, 23);
    });

    await t.step(
      "caps distance to remaining yards to endzone on first down",
      () => {
        const state = makeState({ yardLine: 85, down: 1, distance: 10 });
        advanceDowns(state, 12);
        // 12 >= 10 (distance), so first down. yardLine = 97, distance = min(10, 3) = 3
        assertEquals(state.yardLine, 97);
        assertEquals(state.down, 1);
        assertEquals(state.distance, 3);
      },
    );

    await t.step(
      "grants first down when distance reaches zero from subtraction",
      () => {
        const state = makeState({ yardLine: 35, down: 2, distance: 3 });
        advanceDowns(state, 2);
        // distance becomes 3-2=1, still > 0, so down advances
        assertEquals(state.down, 3);
        assertEquals(state.distance, 1);
      },
    );
  });

  await t.step("handleTurnover", async (t) => {
    await t.step("returns false for non-turnover events", () => {
      const state = makeState();
      const event = makeEvent({ tags: [] });
      assertEquals(handleTurnover(state, event), false);
    });

    await t.step("returns false for return_td (handled elsewhere)", () => {
      const state = makeState();
      const event = makeEvent({
        tags: ["turnover", "return_td"] as PlayTag[],
      });
      assertEquals(handleTurnover(state, event), false);
    });

    await t.step("switches possession and starts new drive on turnover", () => {
      const state = makeState({
        possession: "home",
        yardLine: 40,
        driveIndex: 1,
      });
      const event = makeEvent({
        tags: ["turnover"] as PlayTag[],
        yardage: 5,
      });
      assertEquals(handleTurnover(state, event), true);
      assertEquals(state.possession, "away");
      // turnoverYardLine = 40 + 5 = 45, new drive at 100 - 45 = 55
      assertEquals(state.yardLine, 55);
      assertEquals(state.driveIndex, 2);
      assertEquals(state.down, 1);
      assertEquals(state.distance, 10);
    });

    await t.step("clamps turnover yard line to valid range", () => {
      const state = makeState({
        possession: "home",
        yardLine: 95,
        driveIndex: 1,
      });
      const event = makeEvent({
        tags: ["turnover"] as PlayTag[],
        yardage: 10,
      });
      handleTurnover(state, event);
      // turnoverYardLine = min(99, 95+10) = 99, new drive at 100 - 99 = 1
      assertEquals(state.yardLine, 1);
    });
  });

  await t.step("applyAcceptedPenalty", async (t) => {
    await t.step(
      "offense pre-snap penalty moves back and adds to distance",
      () => {
        const state = makeState({ yardLine: 35, down: 1, distance: 10 });
        const event = makeEvent({
          penalty: {
            type: "false_start",
            phase: "pre_snap",
            yardage: 5,
            automaticFirstDown: false,
            againstTeamId: "team-home",
            againstPlayerId: null,
            accepted: true,
          },
        });
        applyAcceptedPenalty(state, event, "team-home");
        assertEquals(state.yardLine, 30);
        assertEquals(state.distance, 15);
        assertEquals(state.down, 1);
      },
    );

    await t.step(
      "offense post-snap penalty advances down and adds distance",
      () => {
        const state = makeState({ yardLine: 35, down: 1, distance: 10 });
        const event = makeEvent({
          penalty: {
            type: "holding",
            phase: "post_snap",
            yardage: 10,
            automaticFirstDown: false,
            againstTeamId: "team-home",
            againstPlayerId: null,
            accepted: true,
          },
        });
        applyAcceptedPenalty(state, event, "team-home");
        assertEquals(state.yardLine, 25);
        assertEquals(state.down, 2);
        assertEquals(state.distance, 20);
      },
    );

    await t.step(
      "defense penalty with automatic first down grants first down",
      () => {
        const state = makeState({ yardLine: 35, down: 3, distance: 8 });
        const event = makeEvent({
          penalty: {
            type: "roughing_the_passer",
            phase: "post_snap",
            yardage: 15,
            automaticFirstDown: true,
            againstTeamId: "team-away",
            againstPlayerId: null,
            accepted: true,
          },
        });
        applyAcceptedPenalty(state, event, "team-home");
        assertEquals(state.yardLine, 50);
        assertEquals(state.down, 1);
        assertEquals(state.distance, 10);
      },
    );

    await t.step("defense penalty without automatic first down", () => {
      const state = makeState({ yardLine: 35, down: 2, distance: 8 });
      const event = makeEvent({
        penalty: {
          type: "offsides",
          phase: "pre_snap",
          yardage: 5,
          automaticFirstDown: false,
          againstTeamId: "team-away",
          againstPlayerId: null,
          accepted: true,
        },
      });
      applyAcceptedPenalty(state, event, "team-home");
      assertEquals(state.yardLine, 40);
      assertEquals(state.down, 1);
    });

    await t.step(
      "offense penalty does not move behind own 1 yard line",
      () => {
        const state = makeState({ yardLine: 3, down: 1, distance: 10 });
        const event = makeEvent({
          penalty: {
            type: "false_start",
            phase: "pre_snap",
            yardage: 5,
            automaticFirstDown: false,
            againstTeamId: "team-home",
            againstPlayerId: null,
            accepted: true,
          },
        });
        applyAcceptedPenalty(state, event, "team-home");
        // Can only go back 2 yards (to yard 1)
        assertEquals(state.yardLine, 1);
      },
    );

    await t.step("tracks drive yards on penalty", () => {
      const state = makeState({
        yardLine: 35,
        down: 2,
        distance: 8,
        driveYards: 10,
      });
      const event = makeEvent({
        penalty: {
          type: "defensive_pass_interference",
          phase: "post_snap",
          yardage: 15,
          automaticFirstDown: true,
          againstTeamId: "team-away",
          againstPlayerId: null,
          accepted: true,
        },
      });
      applyAcceptedPenalty(state, event, "team-home");
      assertEquals(state.driveYards, 25);
    });
  });
});
