import { assertEquals } from "@std/assert";
import {
  addScore,
  advanceDowns,
  applyKneel,
  applyPenaltyYardage,
  createInitialState,
  flipPossession,
  incrementGlobalPlayIndex,
  incrementPlayIndex,
  recordPlay,
  resetHalfTimeouts,
  setClock,
  setPossession,
  setQuarter,
  type SimulationState,
  startNewDrive,
  tickClock,
  useTimeout,
} from "./game-state-manager.ts";

function makeState(overrides: Partial<SimulationState> = {}): SimulationState {
  return createInitialState({
    kickoffYardLine: 35,
    ...overrides,
  });
}

Deno.test("createInitialState sets default values", () => {
  const state = createInitialState({ kickoffYardLine: 35 });
  assertEquals(state.quarter, 1);
  assertEquals(state.clock, 900);
  assertEquals(state.homeScore, 0);
  assertEquals(state.awayScore, 0);
  assertEquals(state.possession, "home");
  assertEquals(state.yardLine, 35);
  assertEquals(state.down, 1);
  assertEquals(state.distance, 10);
  assertEquals(state.driveIndex, 0);
  assertEquals(state.playIndex, 0);
  assertEquals(state.globalPlayIndex, 0);
  assertEquals(state.driveStartYardLine, 35);
  assertEquals(state.drivePlays, 0);
  assertEquals(state.driveYards, 0);
  assertEquals(state.homeTimeouts, 3);
  assertEquals(state.awayTimeouts, 3);
});

Deno.test("startNewDrive resets drive state and increments driveIndex", () => {
  const state = makeState({ driveIndex: 2, playIndex: 5, drivePlays: 8 });
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

Deno.test("flipPossession toggles home to away", () => {
  const state = makeState({ possession: "home" });
  flipPossession(state);
  assertEquals(state.possession, "away");
});

Deno.test("flipPossession toggles away to home", () => {
  const state = makeState({ possession: "away" });
  flipPossession(state);
  assertEquals(state.possession, "home");
});

Deno.test("setPossession sets possession directly", () => {
  const state = makeState({ possession: "home" });
  setPossession(state, "away");
  assertEquals(state.possession, "away");
});

Deno.test("advanceDowns grants first down when yardage meets distance", () => {
  const state = makeState({ yardLine: 50, down: 2, distance: 8 });
  advanceDowns(state, 8);
  assertEquals(state.yardLine, 58);
  assertEquals(state.down, 1);
  assertEquals(state.distance, 10);
});

Deno.test("advanceDowns grants first down when yardage exceeds distance", () => {
  const state = makeState({ yardLine: 50, down: 1, distance: 10 });
  advanceDowns(state, 15);
  assertEquals(state.yardLine, 65);
  assertEquals(state.down, 1);
  assertEquals(state.distance, 10);
});

Deno.test("advanceDowns increments down when yardage is short", () => {
  const state = makeState({ yardLine: 50, down: 1, distance: 10 });
  advanceDowns(state, 3);
  assertEquals(state.yardLine, 53);
  assertEquals(state.down, 2);
  assertEquals(state.distance, 7);
});

Deno.test("advanceDowns clamps yardLine to minimum 1", () => {
  const state = makeState({ yardLine: 2, down: 1, distance: 10 });
  advanceDowns(state, -5);
  assertEquals(state.yardLine, 1);
});

Deno.test("advanceDowns caps distance at yards to endzone", () => {
  const state = makeState({ yardLine: 95, down: 2, distance: 3 });
  advanceDowns(state, 3);
  assertEquals(state.yardLine, 98);
  assertEquals(state.down, 1);
  assertEquals(state.distance, 2);
});

Deno.test("advanceDowns grants first down when remaining distance becomes zero or less", () => {
  const state = makeState({ yardLine: 50, down: 2, distance: 3 });
  advanceDowns(state, 2);
  assertEquals(state.down, 3);
  assertEquals(state.distance, 1);
});

Deno.test("advanceDowns caps down at 4", () => {
  const state = makeState({ yardLine: 50, down: 4, distance: 10 });
  advanceDowns(state, 3);
  assertEquals(state.down, 4);
  assertEquals(state.distance, 7);
});

Deno.test("advanceDowns accumulates driveYards", () => {
  const state = makeState({
    yardLine: 50,
    down: 1,
    distance: 10,
    driveYards: 20,
  });
  advanceDowns(state, 7);
  assertEquals(state.driveYards, 27);
});

Deno.test("addScore adds points to home", () => {
  const state = makeState({ homeScore: 7 });
  addScore(state, "home", 6);
  assertEquals(state.homeScore, 13);
});

Deno.test("addScore adds points to away", () => {
  const state = makeState({ awayScore: 3 });
  addScore(state, "away", 7);
  assertEquals(state.awayScore, 10);
});

Deno.test("recordPlay increments play counters", () => {
  const state = makeState({ drivePlays: 2, globalPlayIndex: 10, playIndex: 3 });
  recordPlay(state);
  assertEquals(state.drivePlays, 3);
  assertEquals(state.globalPlayIndex, 11);
  assertEquals(state.playIndex, 4);
});

Deno.test("incrementGlobalPlayIndex increments only globalPlayIndex", () => {
  const state = makeState({ globalPlayIndex: 5, playIndex: 2, drivePlays: 3 });
  incrementGlobalPlayIndex(state);
  assertEquals(state.globalPlayIndex, 6);
  assertEquals(state.playIndex, 2);
  assertEquals(state.drivePlays, 3);
});

Deno.test("incrementPlayIndex increments only playIndex", () => {
  const state = makeState({ playIndex: 4, globalPlayIndex: 10, drivePlays: 2 });
  incrementPlayIndex(state);
  assertEquals(state.playIndex, 5);
  assertEquals(state.globalPlayIndex, 10);
  assertEquals(state.drivePlays, 2);
});

Deno.test("tickClock subtracts seconds from clock", () => {
  const state = makeState({ clock: 900 });
  tickClock(state, 35);
  assertEquals(state.clock, 865);
});

Deno.test("setClock sets clock directly", () => {
  const state = makeState({ clock: 100 });
  setClock(state, 600);
  assertEquals(state.clock, 600);
});

Deno.test("setQuarter sets quarter and clock", () => {
  const state = makeState();
  setQuarter(state, 2, 900);
  assertEquals(state.quarter, 2);
  assertEquals(state.clock, 900);
});

Deno.test("setQuarter sets OT quarter", () => {
  const state = makeState();
  setQuarter(state, "OT", 600);
  assertEquals(state.quarter, "OT");
  assertEquals(state.clock, 600);
});

Deno.test("useTimeout decrements home timeouts", () => {
  const state = makeState({ homeTimeouts: 3 });
  useTimeout(state, "home");
  assertEquals(state.homeTimeouts, 2);
});

Deno.test("useTimeout decrements away timeouts", () => {
  const state = makeState({ awayTimeouts: 2 });
  useTimeout(state, "away");
  assertEquals(state.awayTimeouts, 1);
});

Deno.test("resetHalfTimeouts resets both sides to 3", () => {
  const state = makeState({ homeTimeouts: 1, awayTimeouts: 0 });
  resetHalfTimeouts(state);
  assertEquals(state.homeTimeouts, 3);
  assertEquals(state.awayTimeouts, 3);
});

Deno.test("applyKneel adjusts down, distance, and yardLine", () => {
  const state = makeState({ down: 1, distance: 10, yardLine: 30 });
  applyKneel(state);
  assertEquals(state.down, 2);
  assertEquals(state.distance, 11);
  assertEquals(state.yardLine, 29);
});

Deno.test("applyKneel caps down at 4", () => {
  const state = makeState({ down: 4, distance: 10, yardLine: 30 });
  applyKneel(state);
  assertEquals(state.down, 4);
  assertEquals(state.distance, 11);
  assertEquals(state.yardLine, 29);
});

Deno.test("applyKneel clamps yardLine to minimum 1", () => {
  const state = makeState({ down: 1, distance: 10, yardLine: 1 });
  applyKneel(state);
  assertEquals(state.yardLine, 1);
});

Deno.test("applyPenaltyYardage against offense moves yard line back", () => {
  const state = makeState({ yardLine: 50, down: 1, distance: 10 });
  applyPenaltyYardage(state, {
    isAgainstOffense: true,
    penaltyYardage: 10,
    phase: "pre_snap",
    automaticFirstDown: false,
  });
  assertEquals(state.yardLine, 40);
  assertEquals(state.distance, 20);
  assertEquals(state.driveYards, -10);
});

Deno.test("applyPenaltyYardage against offense post-snap increments down", () => {
  const state = makeState({ yardLine: 50, down: 1, distance: 10 });
  applyPenaltyYardage(state, {
    isAgainstOffense: true,
    penaltyYardage: 5,
    phase: "post_snap",
    automaticFirstDown: false,
  });
  assertEquals(state.yardLine, 45);
  assertEquals(state.down, 2);
  assertEquals(state.distance, 15);
});

Deno.test("applyPenaltyYardage against offense clamps at own 1", () => {
  const state = makeState({ yardLine: 3, down: 1, distance: 10 });
  applyPenaltyYardage(state, {
    isAgainstOffense: true,
    penaltyYardage: 10,
    phase: "pre_snap",
    automaticFirstDown: false,
  });
  assertEquals(state.yardLine, 1);
});

Deno.test("applyPenaltyYardage against defense moves yard line forward", () => {
  const state = makeState({ yardLine: 50, down: 2, distance: 8 });
  applyPenaltyYardage(state, {
    isAgainstOffense: false,
    penaltyYardage: 10,
    phase: "post_snap",
    automaticFirstDown: false,
  });
  assertEquals(state.yardLine, 60);
  assertEquals(state.down, 1);
});

Deno.test("applyPenaltyYardage against defense with automatic first down", () => {
  const state = makeState({ yardLine: 50, down: 3, distance: 15 });
  applyPenaltyYardage(state, {
    isAgainstOffense: false,
    penaltyYardage: 5,
    phase: "post_snap",
    automaticFirstDown: true,
  });
  assertEquals(state.yardLine, 55);
  assertEquals(state.down, 1);
  assertEquals(state.distance, 10);
});

Deno.test("applyPenaltyYardage against defense clamps at endzone", () => {
  const state = makeState({ yardLine: 97, down: 1, distance: 3 });
  applyPenaltyYardage(state, {
    isAgainstOffense: false,
    penaltyYardage: 10,
    phase: "post_snap",
    automaticFirstDown: false,
  });
  assertEquals(state.yardLine, 100);
});
