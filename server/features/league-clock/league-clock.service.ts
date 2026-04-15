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
  advancedAt: Date;
  overrideReason: string | null;
  overrideBlockers: unknown;
  autoResolved: Blocker[];
  looped: boolean;
}

export interface LeagueClockService {
  advance(
    leagueId: string,
    actor: Actor,
    gateState: LeagueGateState,
  ): Promise<AdvanceResult>;
}

export function createLeagueClockService(deps: {
  txRunner: TransactionRunner;
  leagueClockRepo: LeagueClockRepository;
  log: pino.Logger;
}): LeagueClockService {
  const log = deps.log.child({ module: "league-clock.service" });
  const phases = leaguePhaseEnum.enumValues;

  return {
    async advance(leagueId, actor, gateState) {
      log.info({ leagueId, userId: actor.userId }, "advancing league clock");

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
        targetPhase = phases[0];
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
          },
          tx,
        );

        return {
          leagueId: row.leagueId,
          seasonYear: row.seasonYear,
          phase: row.phase,
          stepIndex: row.stepIndex,
          advancedAt: row.advancedAt,
          overrideReason: row.overrideReason,
          overrideBlockers: row.overrideBlockers,
          autoResolved,
          looped,
        };
      });
    },
  };
}
