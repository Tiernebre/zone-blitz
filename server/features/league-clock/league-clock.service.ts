import { DomainError } from "@zone-blitz/shared";
import type pino from "pino";
import type { TransactionRunner } from "../../db/transaction-runner.ts";
import type { LeagueClockRepository } from "./league-clock.repository.ts";
import {
  type Blocker,
  computeNextStep,
  type GateResult,
  getGateForPhase,
  type LeagueGateState,
  resolveAutoBlockers,
} from "./gates.ts";
import { DEFAULT_PHASE_STEPS } from "./default-phase-steps.ts";
import { leaguePhaseEnum } from "./league-clock.schema.ts";
import type { PhaseStepListener } from "./phase-step-listener.ts";

// The first phase of a Year-1 league. Exported so other features can
// seed the clock at this phase without hardcoding the string.
export const FIRST_INITIAL_PHASE: typeof leaguePhaseEnum.enumValues[number] =
  "initial_staff_hiring";

export interface Actor {
  userId: string;
  isCommissioner: boolean;
  overrideReason?: string;
}

export interface AdvanceResult {
  leagueId: string;
  seasonYear: number;
  phase: string;
  stepIndex: number;
  slug: string;
  flavorDate: string | null;
  advancedAt: Date;
  overrideReason: string | null;
  overrideBlockers: unknown;
  autoResolved: Blocker[];
  looped: boolean;
}

export interface ClockState {
  leagueId: string;
  seasonYear: number;
  phase: string;
  stepIndex: number;
  slug: string;
  kind: string;
  flavorDate: string | null;
  advancedAt: Date;
  hasCompletedInitial: boolean;
}

export interface ReadyCheckState {
  policy: "commissioner" | "ready_check";
  votedTeamIds: string[];
  activeHumanTeamIds: string[];
}

export interface VoteResult {
  leagueId: string;
  teamId: string;
  phase: string;
  stepIndex: number;
  readyAt: Date;
}

export interface LeagueClockService {
  getClockState(leagueId: string): Promise<ClockState>;
  advance(
    leagueId: string,
    actor: Actor,
    gateState: LeagueGateState,
    readyCheckState?: ReadyCheckState,
  ): Promise<AdvanceResult>;

  castVote(
    leagueId: string,
    teamId: string,
  ): Promise<VoteResult>;
}

interface TargetStep {
  seasonYear: number;
  phase: string;
  stepIndex: number;
  looped: boolean;
}

interface GateOutcome {
  overrideReason: string | null;
  overrideBlockers: Blocker[] | null;
  autoResolved: Blocker[];
}

const ROLLOVER_PHASE = "offseason_rollover";
const INITIAL_PHASE_PREFIX = "initial_";
const INITIAL_KICKOFF_PHASE = "initial_kickoff";
// Year 1 skips the offseason and kicks off directly into the regular
// season, so the kickoff redirect does not use firstRecurringPhase
// (which is the chronologically-first recurring phase, the offseason).
const KICKOFF_TARGET_PHASE = "regular_season";

function assertReadyCheckComplete(
  actor: Actor,
  readyCheckState: ReadyCheckState | undefined,
): void {
  const policy = readyCheckState?.policy ?? "commissioner";
  if (policy !== "ready_check" || actor.isCommissioner) return;

  const voted = new Set(readyCheckState!.votedTeamIds);
  const allReady = readyCheckState!.activeHumanTeamIds.every((id) =>
    voted.has(id)
  );
  if (!allReady) {
    throw new DomainError(
      "READY_CHECK_INCOMPLETE",
      "Not all active human teams have voted ready",
    );
  }
}

function computeTargetStep(
  clock: { phase: string; stepIndex: number; seasonYear: number },
  phases: readonly string[],
  firstRecurringPhase: string,
): TargetStep {
  const rolloverSteps = DEFAULT_PHASE_STEPS.filter(
    (s) => s.phase === ROLLOVER_PHASE,
  );
  const rolloverMaxStep = Math.max(
    ...rolloverSteps.map((s) => s.stepIndex),
  );
  const isAtRolloverEnd = clock.phase === ROLLOVER_PHASE &&
    clock.stepIndex === rolloverMaxStep;

  if (isAtRolloverEnd) {
    return {
      seasonYear: clock.seasonYear + 1,
      phase: firstRecurringPhase,
      stepIndex: 0,
      looped: true,
    };
  }

  const next = computeNextStep(
    { phase: clock.phase, stepIndex: clock.stepIndex },
    DEFAULT_PHASE_STEPS,
    phases,
  );
  if (!next) {
    throw new DomainError(
      "INVALID_STATE",
      "League clock is at the final step and cannot advance further",
    );
  }
  return {
    seasonYear: clock.seasonYear,
    phase: next.phase,
    stepIndex: next.stepIndex,
    looped: false,
  };
}

// Year 1's final initial step (`initial_kickoff`) hands off to the
// first recurring phase rather than the natural next step, because
// recurring phases don't share an ordering with initial ones.
function redirectKickoffToRecurring(
  clock: { phase: string },
  target: TargetStep,
): { target: TargetStep; setInitialComplete: true | undefined } {
  const isLeavingInitial = clock.phase === INITIAL_KICKOFF_PHASE &&
    !target.phase.startsWith(INITIAL_PHASE_PREFIX);
  if (!isLeavingInitial) {
    return { target, setInitialComplete: undefined };
  }
  return {
    target: { ...target, phase: KICKOFF_TARGET_PHASE, stepIndex: 0 },
    setInitialComplete: true,
  };
}

function resolveGateOutcome(
  targetPhase: string,
  gateState: LeagueGateState,
  actor: Actor,
  log: pino.Logger,
  leagueId: string,
): GateOutcome {
  const gate = getGateForPhase(targetPhase);
  if (!gate) {
    return { overrideReason: null, overrideBlockers: null, autoResolved: [] };
  }
  const gateResult: GateResult = gate(gateState);
  if (gateResult.ok) {
    return { overrideReason: null, overrideBlockers: null, autoResolved: [] };
  }

  const { resolved, remaining } = resolveAutoBlockers(gateResult);
  if (remaining.length === 0) {
    return {
      overrideReason: null,
      overrideBlockers: null,
      autoResolved: resolved,
    };
  }

  if (!actor.isCommissioner || !actor.overrideReason) {
    throw new DomainError(
      "GATE_BLOCKED",
      `Cannot advance to ${targetPhase}: ${
        remaining.map((b) => b.reason).join("; ")
      }`,
    );
  }

  log.warn(
    {
      leagueId,
      phase: targetPhase,
      overrideReason: actor.overrideReason,
      blockerCount: remaining.length,
    },
    "commissioner override",
  );
  return {
    overrideReason: actor.overrideReason,
    overrideBlockers: remaining,
    autoResolved: resolved,
  };
}

export function createLeagueClockService(deps: {
  txRunner: TransactionRunner;
  leagueClockRepo: LeagueClockRepository;
  log: pino.Logger;
  stepEffects?: PhaseStepListener;
}): LeagueClockService {
  const log = deps.log.child({ module: "league-clock.service" });
  const phases = leaguePhaseEnum.enumValues;
  const firstRecurringPhase = phases.find(
    (p) => !p.startsWith("initial_"),
  )!;

  return {
    async getClockState(leagueId) {
      log.debug({ leagueId }, "fetching league clock state");
      const clock = await deps.leagueClockRepo.getByLeagueId(leagueId);
      if (!clock) {
        throw new DomainError(
          "NOT_FOUND",
          `League clock for ${leagueId} not found`,
        );
      }

      const step = DEFAULT_PHASE_STEPS.find(
        (s) => s.phase === clock.phase && s.stepIndex === clock.stepIndex,
      );

      return {
        leagueId: clock.leagueId,
        seasonYear: clock.seasonYear,
        phase: clock.phase,
        stepIndex: clock.stepIndex,
        slug: step?.slug ?? "",
        kind: step?.kind ?? "",
        flavorDate: step?.flavorDate ?? null,
        advancedAt: clock.advancedAt,
        hasCompletedInitial: clock.hasCompletedInitial,
      };
    },

    async advance(leagueId, actor, gateState, readyCheckState?) {
      log.info({ leagueId, userId: actor.userId }, "advancing league clock");

      assertReadyCheckComplete(actor, readyCheckState);

      const clock = await deps.leagueClockRepo.getByLeagueId(leagueId);
      if (!clock) {
        throw new DomainError(
          "NOT_FOUND",
          `League clock for ${leagueId} not found`,
        );
      }

      const initialTarget = computeTargetStep(
        clock,
        phases,
        firstRecurringPhase,
      );
      if (initialTarget.looped) {
        log.info(
          { leagueId, newSeasonYear: initialTarget.seasonYear },
          "offseason rollover: looping to new season",
        );
      }

      if (
        initialTarget.phase.startsWith(INITIAL_PHASE_PREFIX) &&
        clock.hasCompletedInitial
      ) {
        throw new DomainError(
          "INITIAL_COMPLETED",
          "Cannot re-enter initial phases after Year 1",
        );
      }

      const { target, setInitialComplete } = redirectKickoffToRecurring(
        clock,
        initialTarget,
      );

      const gateOutcome = resolveGateOutcome(
        target.phase,
        gateState,
        actor,
        log,
        leagueId,
      );

      const targetStep = DEFAULT_PHASE_STEPS.find(
        (s) => s.phase === target.phase && s.stepIndex === target.stepIndex,
      );

      if (deps.stepEffects) {
        const prevStep = DEFAULT_PHASE_STEPS.find(
          (s) => s.phase === clock.phase && s.stepIndex === clock.stepIndex,
        );
        await deps.stepEffects.onTransition({
          leagueId,
          prevStepSlug: prevStep?.slug ?? "",
          nextStepSlug: targetStep?.slug ?? "",
        });
      }

      return await deps.txRunner.run(async (tx) => {
        const row = await deps.leagueClockRepo.upsert(
          {
            leagueId,
            seasonYear: target.seasonYear,
            phase: target.phase,
            stepIndex: target.stepIndex,
            advancedByUserId: actor.userId,
            overrideReason: gateOutcome.overrideReason,
            overrideBlockers: gateOutcome.overrideBlockers,
            hasCompletedInitial: setInitialComplete,
          },
          tx,
        );

        return {
          leagueId: row.leagueId,
          seasonYear: row.seasonYear,
          phase: row.phase,
          stepIndex: row.stepIndex,
          slug: targetStep?.slug ?? "",
          flavorDate: targetStep?.flavorDate ?? null,
          advancedAt: row.advancedAt,
          overrideReason: row.overrideReason,
          overrideBlockers: row.overrideBlockers,
          autoResolved: gateOutcome.autoResolved,
          looped: target.looped,
        };
      });
    },

    async castVote(leagueId, teamId) {
      log.info({ leagueId, teamId }, "casting ready vote");

      const clock = await deps.leagueClockRepo.getByLeagueId(leagueId);
      if (!clock) {
        throw new DomainError(
          "NOT_FOUND",
          `League clock for ${leagueId} not found`,
        );
      }

      const row = await deps.leagueClockRepo.castVote({
        leagueId,
        teamId,
        phase: clock.phase,
        stepIndex: clock.stepIndex,
      });

      return {
        leagueId: row.leagueId,
        teamId: row.teamId,
        phase: row.phase,
        stepIndex: row.stepIndex,
        readyAt: row.readyAt,
      };
    },
  };
}
