/**
 * Centralized state-manager for MutableGameState.
 *
 * All field mutations go through these functions. The public type
 * `SimulationState` is `Readonly<MutableGameState>`, so direct
 * `state.down = ...` outside this module is a TypeScript error.
 */

import type { MutableGameState } from "./game-clock.ts";
import { TIMEOUTS_PER_HALF } from "./game-clock.ts";

export type SimulationState = Readonly<MutableGameState>;

function asMutable(state: SimulationState): MutableGameState {
  return state as MutableGameState;
}

// -- Drive management --

export function startNewDrive(
  state: SimulationState,
  yardLine: number,
): void {
  const s = asMutable(state);
  s.driveIndex++;
  s.playIndex = 0;
  s.yardLine = yardLine;
  s.down = 1;
  s.distance = 10;
  s.driveStartYardLine = yardLine;
  s.drivePlays = 0;
  s.driveYards = 0;
}

export function flipPossession(state: SimulationState): void {
  const s = asMutable(state);
  s.possession = s.possession === "home" ? "away" : "home";
}

export function setPossession(
  state: SimulationState,
  side: "home" | "away",
): void {
  asMutable(state).possession = side;
}

// -- Down / distance / yardline --

export function advanceDowns(
  state: SimulationState,
  yardage: number,
): void {
  const s = asMutable(state);
  s.yardLine += yardage;
  s.driveYards += yardage;

  if (s.yardLine <= 0) {
    s.yardLine = 1;
  }

  if (yardage >= s.distance) {
    s.down = 1;
    s.distance = Math.min(10, 100 - s.yardLine);
  } else {
    s.distance -= yardage;
    if (s.distance <= 0) {
      s.down = 1;
      s.distance = Math.min(10, 100 - s.yardLine);
    } else {
      s.down = Math.min(s.down + 1, 4) as 1 | 2 | 3 | 4;
    }
  }
}

export function applyKneel(state: SimulationState): void {
  const s = asMutable(state);
  s.down = Math.min(s.down + 1, 4) as 1 | 2 | 3 | 4;
  s.distance += 1;
  s.yardLine -= 1;
  if (s.yardLine < 1) s.yardLine = 1;
}

export interface PenaltyParams {
  isAgainstOffense: boolean;
  penaltyYardage: number;
  phase: "pre_snap" | "post_snap";
  automaticFirstDown: boolean;
}

export function applyPenaltyYardage(
  state: SimulationState,
  penalty: PenaltyParams,
): void {
  const s = asMutable(state);

  if (penalty.isAgainstOffense) {
    const penaltyYards = -Math.min(penalty.penaltyYardage, s.yardLine - 1);
    s.yardLine += penaltyYards;
    s.driveYards += penaltyYards;
    if (penalty.phase === "pre_snap") {
      s.distance = Math.min(
        s.distance + penalty.penaltyYardage,
        100 - s.yardLine,
      );
    } else {
      s.down = Math.min(s.down + 1, 4) as 1 | 2 | 3 | 4;
      s.distance = Math.min(
        s.distance + penalty.penaltyYardage,
        100 - s.yardLine,
      );
    }
  } else {
    const penaltyYards = Math.min(penalty.penaltyYardage, 100 - s.yardLine);
    s.yardLine += penaltyYards;
    s.driveYards += penaltyYards;
    if (penalty.automaticFirstDown) {
      s.down = 1;
      s.distance = Math.min(10, 100 - s.yardLine);
    } else {
      s.down = 1;
      s.distance = Math.max(1, s.distance - penalty.penaltyYardage);
      if (s.distance <= 0 || penalty.penaltyYardage >= s.distance) {
        s.distance = Math.min(10, 100 - s.yardLine);
      }
    }
  }
}

// -- Scoring --

export function addScore(
  state: SimulationState,
  side: "home" | "away",
  points: number,
): void {
  const s = asMutable(state);
  if (side === "home") {
    s.homeScore += points;
  } else {
    s.awayScore += points;
  }
}

// -- Play tracking --

export function recordPlay(state: SimulationState): void {
  const s = asMutable(state);
  s.drivePlays++;
  s.globalPlayIndex++;
  s.playIndex++;
}

export function incrementGlobalPlayIndex(state: SimulationState): void {
  asMutable(state).globalPlayIndex++;
}

export function incrementPlayIndex(state: SimulationState): void {
  asMutable(state).playIndex++;
}

// -- Clock --

export function tickClock(
  state: SimulationState,
  seconds: number,
): void {
  asMutable(state).clock -= seconds;
}

export function setClock(
  state: SimulationState,
  seconds: number,
): void {
  asMutable(state).clock = seconds;
}

export function setQuarter(
  state: SimulationState,
  quarter: 1 | 2 | 3 | 4 | "OT",
  clockSeconds: number,
): void {
  const s = asMutable(state);
  s.quarter = quarter;
  s.clock = clockSeconds;
}

// -- Timeouts --

export function useTimeout(
  state: SimulationState,
  side: "home" | "away",
): void {
  const s = asMutable(state);
  if (side === "home") {
    s.homeTimeouts--;
  } else {
    s.awayTimeouts--;
  }
}

export function resetHalfTimeouts(state: SimulationState): void {
  const s = asMutable(state);
  s.homeTimeouts = TIMEOUTS_PER_HALF;
  s.awayTimeouts = TIMEOUTS_PER_HALF;
}

// -- Factory --

export interface CreateInitialStateOptions {
  kickoffYardLine: number;
  quarter?: 1 | 2 | 3 | 4 | "OT";
  clock?: number;
  homeScore?: number;
  awayScore?: number;
  possession?: "home" | "away";
  yardLine?: number;
  down?: 1 | 2 | 3 | 4;
  distance?: number;
  driveIndex?: number;
  playIndex?: number;
  globalPlayIndex?: number;
  driveStartYardLine?: number;
  drivePlays?: number;
  driveYards?: number;
  homeTimeouts?: number;
  awayTimeouts?: number;
}

const QUARTER_SECONDS = 900;

export function createInitialState(
  options: CreateInitialStateOptions,
): SimulationState {
  const state: MutableGameState = {
    quarter: options.quarter ?? 1,
    clock: options.clock ?? QUARTER_SECONDS,
    homeScore: options.homeScore ?? 0,
    awayScore: options.awayScore ?? 0,
    possession: options.possession ?? "home",
    yardLine: options.yardLine ?? options.kickoffYardLine,
    down: options.down ?? 1,
    distance: options.distance ?? 10,
    driveIndex: options.driveIndex ?? 0,
    playIndex: options.playIndex ?? 0,
    globalPlayIndex: options.globalPlayIndex ?? 0,
    driveStartYardLine: options.driveStartYardLine ?? options.kickoffYardLine,
    drivePlays: options.drivePlays ?? 0,
    driveYards: options.driveYards ?? 0,
    homeTimeouts: options.homeTimeouts ?? TIMEOUTS_PER_HALF,
    awayTimeouts: options.awayTimeouts ?? TIMEOUTS_PER_HALF,
  };
  return state;
}
