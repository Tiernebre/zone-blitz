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

export interface StepTransitionEffects {
  onTransition(input: {
    leagueId: string;
    prevStepSlug: string;
    nextStepSlug: string;
  }): Promise<void>;
}

export function createLeagueClockService(deps: {
  txRunner: TransactionRunner;
  leagueClockRepo: LeagueClockRepository;
  log: pino.Logger;
  stepEffects?: StepTransitionEffects;
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

      const policy = readyCheckState?.policy ?? "commissioner";
      if (policy === "ready_check" && !actor.isCommissioner) {
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

      const clock = await deps.leagueClockRepo.getByLeagueId(leagueId);
      if (!clock) {
        throw new DomainError(
          "NOT_FOUND",
          `League clock for ${leagueId} not found`,
        );
      }

      let looped = false;
      let seasonYear = clock.seasonYear;
      let targetPhase: string;
      let targetStepIndex: number;

      const rolloverSteps = DEFAULT_PHASE_STEPS.filter(
        (s) => s.phase === "offseason_rollover",
      );
      const rolloverMaxStep = Math.max(
        ...rolloverSteps.map((s) => s.stepIndex),
      );
      const isAtRolloverEnd = clock.phase === "offseason_rollover" &&
        clock.stepIndex === rolloverMaxStep;

      if (isAtRolloverEnd) {
        seasonYear = clock.seasonYear + 1;
        targetPhase = firstRecurringPhase;
        targetStepIndex = 0;
        looped = true;
        log.info(
          { leagueId, newSeasonYear: seasonYear },
          "offseason rollover: looping to new season",
        );
      } else {
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

        targetPhase = next.phase;
        targetStepIndex = next.stepIndex;
      }

      if (
        targetPhase.startsWith("initial_") && clock.hasCompletedInitial
      ) {
        throw new DomainError(
          "INITIAL_COMPLETED",
          "Cannot re-enter initial phases after Year 1",
        );
      }

      const isLeavingInitial = clock.phase === "initial_kickoff" &&
        !targetPhase.startsWith("initial_");
      const setInitialComplete = isLeavingInitial ? true : undefined;

      if (isLeavingInitial) {
        targetPhase = "regular_season";
        targetStepIndex = 0;
      }

      const gate = getGateForPhase(targetPhase);
      let overrideReason: string | null = null;
      let overrideBlockers: Blocker[] | null = null;
      let autoResolved: Blocker[] = [];

      if (gate) {
        const gateResult: GateResult = gate(gateState);

        if (!gateResult.ok) {
          const { resolved, remaining } = resolveAutoBlockers(gateResult);
          autoResolved = resolved;

          if (remaining.length > 0) {
            if (!actor.isCommissioner || !actor.overrideReason) {
              throw new DomainError(
                "GATE_BLOCKED",
                `Cannot advance to ${targetPhase}: ${
                  remaining.map((b) => b.reason).join("; ")
                }`,
              );
            }

            overrideReason = actor.overrideReason;
            overrideBlockers = remaining;
            log.warn(
              {
                leagueId,
                phase: targetPhase,
                overrideReason,
                blockerCount: remaining.length,
              },
              "commissioner override",
            );
          }
        }
      }

      const targetStep = DEFAULT_PHASE_STEPS.find(
        (s) => s.phase === targetPhase && s.stepIndex === targetStepIndex,
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
            seasonYear,
            phase: targetPhase,
            stepIndex: targetStepIndex,
            advancedByUserId: actor.userId,
            overrideReason,
            overrideBlockers,
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
          autoResolved,
          looped,
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
