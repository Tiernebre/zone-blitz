import type { DefaultPhaseStep } from "./default-phase-steps.ts";

export interface Blocker {
  teamId: string;
  reason: string;
  autoResolvable: boolean;
}

export type GateResult =
  | { ok: true }
  | { ok: false; blockers: Blocker[] };

export interface TeamGateState {
  teamId: string;
  isNpc: boolean;
  autoPilot: boolean;
  capCompliant: boolean;
  activeRosterCount: number;
  rosterLimit: number;
}

export interface LeagueGateState {
  teams: TeamGateState[];
  draftOrderResolved: boolean;
  superBowlPlayed: boolean;
  priorPhaseComplete: boolean;
  allTeamsHaveStaff: boolean;
}

export type GateFn = (state: LeagueGateState) => GateResult;

const GATE_OK: GateResult = { ok: true };

function enterRegularSeason(state: LeagueGateState): GateResult {
  const blockers: Blocker[] = [];
  for (const team of state.teams) {
    if (!team.capCompliant) {
      blockers.push({
        teamId: team.teamId,
        reason: "Team is not cap-compliant",
        autoResolvable: team.isNpc || team.autoPilot,
      });
    }
    if (team.activeRosterCount !== team.rosterLimit) {
      blockers.push({
        teamId: team.teamId,
        reason:
          `Active roster is ${team.activeRosterCount}, must be ${team.rosterLimit}`,
        autoResolvable: team.isNpc || team.autoPilot,
      });
    }
  }
  return blockers.length > 0 ? { ok: false, blockers } : GATE_OK;
}

function enterDraft(state: LeagueGateState): GateResult {
  const blockers: Blocker[] = [];
  if (!state.priorPhaseComplete) {
    blockers.push({
      teamId: "",
      reason: "Prior phase is not complete",
      autoResolvable: false,
    });
  }
  if (!state.draftOrderResolved) {
    blockers.push({
      teamId: "",
      reason: "Draft order has not been resolved",
      autoResolvable: false,
    });
  }
  return blockers.length > 0 ? { ok: false, blockers } : GATE_OK;
}

function enterGenesisFoundingPool(state: LeagueGateState): GateResult {
  if (!state.allTeamsHaveStaff) {
    return {
      ok: false,
      blockers: [{
        teamId: "",
        reason:
          "All teams must hire staff before generating the founding player pool",
        autoResolvable: false,
      }],
    };
  }
  return GATE_OK;
}

function enterOffseasonRollover(state: LeagueGateState): GateResult {
  if (!state.superBowlPlayed) {
    return {
      ok: false,
      blockers: [{
        teamId: "",
        reason: "Super Bowl has not been played",
        autoResolvable: false,
      }],
    };
  }
  return GATE_OK;
}

const PHASE_GATES: Partial<Record<string, GateFn>> = {
  genesis_founding_pool: enterGenesisFoundingPool,
  regular_season: enterRegularSeason,
  draft: enterDraft,
  offseason_rollover: enterOffseasonRollover,
};

export function getGateForPhase(phase: string): GateFn | undefined {
  return PHASE_GATES[phase];
}

export function resolveAutoBlockers(
  result: GateResult,
): { resolved: Blocker[]; remaining: Blocker[] } {
  if (result.ok) return { resolved: [], remaining: [] };
  const resolved: Blocker[] = [];
  const remaining: Blocker[] = [];
  for (const b of result.blockers) {
    if (b.autoResolvable) {
      resolved.push(b);
    } else {
      remaining.push(b);
    }
  }
  return { resolved, remaining };
}

export type LeaguePhase =
  typeof import("./league-clock.schema.ts").leaguePhaseEnum.enumValues[number];

export interface PhaseStepPosition {
  phase: string;
  stepIndex: number;
}

export function computeNextStep(
  current: PhaseStepPosition,
  catalog: DefaultPhaseStep[],
  phaseOrder: readonly string[],
): PhaseStepPosition | null {
  const currentPhaseSteps = catalog.filter((s) => s.phase === current.phase);
  const maxStepIndex = Math.max(...currentPhaseSteps.map((s) => s.stepIndex));

  if (current.stepIndex < maxStepIndex) {
    return { phase: current.phase, stepIndex: current.stepIndex + 1 };
  }

  const currentPhaseIndex = phaseOrder.indexOf(current.phase);
  if (currentPhaseIndex < 0 || currentPhaseIndex >= phaseOrder.length - 1) {
    return null;
  }

  const nextPhase = phaseOrder[currentPhaseIndex + 1];
  return { phase: nextPhase, stepIndex: 0 };
}
