import type { PlayEvent } from "./events.ts";
import type { SeededRng } from "./rng.ts";
import { isTwoMinuteDrill } from "./resolve-play.ts";

export const QUARTER_SECONDS = 900;
export const SECONDS_PER_PLAY = 34.8;
export const OT_SECONDS = 600;
export const TIMEOUTS_PER_HALF = 3;
export const KNEEL_CLOCK_BURN = 40;

export interface MutableGameState {
  quarter: 1 | 2 | 3 | 4 | "OT";
  clock: number;
  homeScore: number;
  awayScore: number;
  possession: "home" | "away";
  yardLine: number;
  down: 1 | 2 | 3 | 4;
  distance: number;
  driveIndex: number;
  playIndex: number;
  globalPlayIndex: number;
  driveStartYardLine: number;
  drivePlays: number;
  driveYards: number;
  homeTimeouts: number;
  awayTimeouts: number;
}

export function formatClock(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function shouldClockStop(event: PlayEvent): boolean {
  return (
    event.outcome === "pass_incomplete" ||
    event.outcome === "spike" ||
    event.tags.includes("penalty") ||
    event.tags.includes("turnover") ||
    event.tags.includes("timeout") ||
    event.outcome === "touchdown" ||
    event.outcome === "field_goal" ||
    event.outcome === "missed_field_goal" ||
    event.outcome === "punt" ||
    event.outcome === "kickoff" ||
    event.outcome === "safety" ||
    event.tags.includes("return_td")
  );
}

export function shouldKneel(state: MutableGameState): boolean {
  if (state.quarter !== 2 && state.quarter !== 4) return false;

  const offenseScore = state.possession === "home"
    ? state.homeScore
    : state.awayScore;
  const defenseScore = state.possession === "home"
    ? state.awayScore
    : state.homeScore;
  if (offenseScore <= defenseScore) return false;

  const downsRemaining = 4 - state.down + 1;
  const clockNeeded = downsRemaining * KNEEL_CLOCK_BURN;
  return state.clock <= clockNeeded && state.clock > 0;
}

export function trySpendTimeout(
  state: MutableGameState,
  rng: SeededRng,
): boolean {
  const twoMinute = isTwoMinuteDrill(state.quarter, formatClock(state.clock));
  if (!twoMinute) return false;

  const offenseTimeouts = state.possession === "home"
    ? state.homeTimeouts
    : state.awayTimeouts;
  const defenseTimeouts = state.possession === "home"
    ? state.awayTimeouts
    : state.homeTimeouts;

  const offenseScore = state.possession === "home"
    ? state.homeScore
    : state.awayScore;
  const defenseScore = state.possession === "home"
    ? state.awayScore
    : state.homeScore;

  const offenseTrailing = offenseScore < defenseScore;
  const defenseLeading = defenseScore > offenseScore;

  if (offenseTrailing && offenseTimeouts > 0 && rng.next() < 0.4) {
    if (state.possession === "home") state.homeTimeouts--;
    else state.awayTimeouts--;
    return true;
  }

  if (defenseLeading && defenseTimeouts > 0 && rng.next() < 0.3) {
    if (state.possession === "home") state.awayTimeouts--;
    else state.homeTimeouts--;
    return true;
  }

  return false;
}
