import type { PlayEvent } from "./events.ts";
import type { SimulationState } from "./game-state-manager.ts";
import {
  advanceDowns as advanceDownsImpl,
  applyPenaltyYardage,
  flipPossession,
  startNewDrive as startNewDriveImpl,
} from "./game-state-manager.ts";

export function startNewDrive(
  state: SimulationState,
  yardLine: number,
): void {
  startNewDriveImpl(state, yardLine);
}

export function switchPossession(state: SimulationState): void {
  flipPossession(state);
}

export function advanceDowns(
  state: SimulationState,
  yardage: number,
): void {
  advanceDownsImpl(state, yardage);
}

export function handleTurnover(
  state: SimulationState,
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
  state: SimulationState,
  event: PlayEvent,
  currentOffenseTeamId: string,
): void {
  const penalty = event.penalty!;
  applyPenaltyYardage(state, {
    isAgainstOffense: penalty.againstTeamId === currentOffenseTeamId,
    penaltyYardage: penalty.yardage,
    phase: penalty.phase,
    automaticFirstDown: penalty.automaticFirstDown,
  });
}
