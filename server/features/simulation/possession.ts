import type { PlayEvent } from "./events.ts";
import type { MutableGameState } from "./game-clock.ts";

export function startNewDrive(state: MutableGameState, yardLine: number): void {
  state.driveIndex++;
  state.playIndex = 0;
  state.yardLine = yardLine;
  state.down = 1;
  state.distance = 10;
  state.driveStartYardLine = yardLine;
  state.drivePlays = 0;
  state.driveYards = 0;
}

export function switchPossession(state: MutableGameState): void {
  state.possession = state.possession === "home" ? "away" : "home";
}

export function advanceDowns(
  state: MutableGameState,
  yardage: number,
): void {
  state.yardLine += yardage;
  state.driveYards += yardage;

  if (state.yardLine <= 0) {
    state.yardLine = 1;
  }

  if (yardage >= state.distance) {
    state.down = 1;
    state.distance = Math.min(10, 100 - state.yardLine);
  } else {
    state.distance -= yardage;
    if (state.distance <= 0) {
      state.down = 1;
      state.distance = Math.min(10, 100 - state.yardLine);
    } else {
      state.down = Math.min(state.down + 1, 4) as 1 | 2 | 3 | 4;
    }
  }
}

export function handleTurnover(
  state: MutableGameState,
  event: PlayEvent,
): boolean {
  if (!event.tags.includes("turnover")) return false;
  if (event.tags.includes("return_td")) return false;

  const turnoverYardLine = Math.max(
    1,
    Math.min(99, state.yardLine + event.yardage),
  );
  switchPossession(state);
  startNewDrive(state, 100 - turnoverYardLine);
  return true;
}

export function applyAcceptedPenalty(
  state: MutableGameState,
  event: PlayEvent,
  currentOffenseTeamId: string,
): void {
  const penalty = event.penalty!;
  const isAgainstOffense = penalty.againstTeamId === currentOffenseTeamId;

  if (isAgainstOffense) {
    const penaltyYards = -Math.min(penalty.yardage, state.yardLine - 1);
    state.yardLine += penaltyYards;
    state.driveYards += penaltyYards;
    if (penalty.phase === "pre_snap") {
      state.distance = Math.min(
        state.distance + penalty.yardage,
        100 - state.yardLine,
      );
    } else {
      state.down = Math.min(state.down + 1, 4) as 1 | 2 | 3 | 4;
      state.distance = Math.min(
        state.distance + penalty.yardage,
        100 - state.yardLine,
      );
    }
  } else {
    const penaltyYards = Math.min(penalty.yardage, 100 - state.yardLine);
    state.yardLine += penaltyYards;
    state.driveYards += penaltyYards;
    if (penalty.automaticFirstDown) {
      state.down = 1;
      state.distance = Math.min(10, 100 - state.yardLine);
    } else {
      state.down = 1;
      state.distance = Math.max(1, state.distance - penalty.yardage);
      if (state.distance <= 0 || penalty.yardage >= state.distance) {
        state.distance = Math.min(10, 100 - state.yardLine);
      }
    }
  }
}
