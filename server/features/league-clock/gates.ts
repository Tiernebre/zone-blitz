import type {
  Blocker,
  GateFunction,
  GateResult,
  LeagueClockState,
} from "./league-clock.types.ts";

export const enterRegularSeasonGate: GateFunction = (
  state: LeagueClockState,
): GateResult => {
  const blockers: Blocker[] = [];

  for (const team of state.teams) {
    if (team.totalCap > state.salaryCap) {
      blockers.push({
        teamId: team.teamId,
        reason:
          `Team is over the salary cap ($${team.totalCap} / $${state.salaryCap})`,
      });
    }
    if (team.rosterCount !== state.rosterSize) {
      blockers.push({
        teamId: team.teamId,
        reason:
          `Team roster is not at the required size (${team.rosterCount} / ${state.rosterSize})`,
      });
    }
  }

  return blockers.length === 0 ? { ok: true } : { ok: false, blockers };
};

export const enterDraftGate: GateFunction = (
  state: LeagueClockState,
): GateResult => {
  if (!state.draftOrderResolved) {
    return {
      ok: false,
      blockers: [
        {
          teamId: state.leagueId,
          reason: "Cannot enter draft: draft order has not been resolved",
        },
      ],
    };
  }
  return { ok: true };
};

export const enterOffseasonRolloverGate: GateFunction = (
  state: LeagueClockState,
): GateResult => {
  if (!state.superBowlPlayed) {
    return {
      ok: false,
      blockers: [
        {
          teamId: state.leagueId,
          reason:
            "Cannot enter offseason rollover: Super Bowl has not been played",
        },
      ],
    };
  }
  return { ok: true };
};

const GATED_PHASES: Record<string, GateFunction> = {
  regular_season: enterRegularSeasonGate,
  draft: enterDraftGate,
  offseason_rollover: enterOffseasonRolloverGate,
};

export function getGateForPhase(phase: string): GateFunction | undefined {
  return GATED_PHASES[phase];
}
