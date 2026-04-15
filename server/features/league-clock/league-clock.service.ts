import { DomainError } from "@zone-blitz/shared";
import type pino from "pino";
import type { TransactionRunner } from "../../db/transaction-runner.ts";
import type { LeagueClockRepository } from "./league-clock.repository.interface.ts";
import type { LeagueClockService } from "./league-clock.service.interface.ts";
import type {
  Actor,
  AdvanceResult,
  Blocker,
  LeagueClockState,
  TeamClockState,
} from "./league-clock.types.ts";
import { getGateForPhase } from "./gates.ts";
import { leaguePhaseEnum } from "./league-clock.schema.ts";

const PHASE_ORDER = leaguePhaseEnum.enumValues;

function resolveNextStep(
  currentPhase: string,
  currentStepIndex: number,
  allSteps: { phase: string; stepIndex: number }[],
): { phase: string; stepIndex: number } {
  const currentPhaseSteps = allSteps
    .filter((s) => s.phase === currentPhase)
    .sort((a, b) => a.stepIndex - b.stepIndex);

  const maxStep = currentPhaseSteps[currentPhaseSteps.length - 1]?.stepIndex ??
    0;

  if (currentStepIndex < maxStep) {
    return { phase: currentPhase, stepIndex: currentStepIndex + 1 };
  }

  const phaseIdx = PHASE_ORDER.indexOf(
    currentPhase as (typeof PHASE_ORDER)[number],
  );
  const nextPhaseIdx = (phaseIdx + 1) % PHASE_ORDER.length;
  return { phase: PHASE_ORDER[nextPhaseIdx], stepIndex: 0 };
}

export function createLeagueClockService(deps: {
  repo: LeagueClockRepository;
  txRunner: TransactionRunner;
  getLeagueConfig: (leagueId: string) => Promise<{
    salaryCap: number;
    rosterSize: number;
    capGrowthRate: number;
    userTeamId: string | null;
  }>;
  log: pino.Logger;
}): LeagueClockService {
  const log = deps.log.child({ module: "league-clock.service" });

  return {
    async advance(leagueId: string, actor: Actor): Promise<AdvanceResult> {
      log.info({ leagueId, actor: actor.userId }, "advancing league clock");

      const clock = await deps.repo.getClock(leagueId);
      if (!clock) {
        throw new DomainError(
          "NOT_FOUND",
          `League clock for ${leagueId} not found`,
        );
      }

      const allSteps = await deps.repo.getAllPhaseSteps();
      const next = resolveNextStep(
        clock.phase,
        clock.stepIndex,
        allSteps,
      );

      const isNewPhase = next.phase !== clock.phase;

      if (isNewPhase) {
        const gate = getGateForPhase(next.phase);
        if (gate) {
          const config = await deps.getLeagueConfig(leagueId);
          const teamSummaries = await deps.repo.getTeamRosterSummaries(
            leagueId,
          );

          const teams: TeamClockState[] = teamSummaries.map((t) => ({
            teamId: t.teamId,
            isHuman: t.teamId === config.userTeamId,
            rosterCount: t.rosterCount,
            totalCap: t.totalCap,
          }));

          const state: LeagueClockState = {
            leagueId,
            salaryCap: config.salaryCap,
            rosterSize: config.rosterSize,
            teams,
            currentPhase: clock.phase,
            currentStepIndex: clock.stepIndex,
            draftOrderResolved: true,
            superBowlPlayed: true,
          };

          let gateResult = gate(state);

          if (!gateResult.ok) {
            const npcBlockers = gateResult.blockers.filter(
              (b) => !teams.find((t) => t.teamId === b.teamId)?.isHuman,
            );
            const humanBlockers = gateResult.blockers.filter(
              (b) => teams.find((t) => t.teamId === b.teamId)?.isHuman,
            );

            if (npcBlockers.length > 0 && humanBlockers.length === 0) {
              const resolvedTeams = teams.map((t) => {
                if (!t.isHuman) {
                  return {
                    ...t,
                    rosterCount: config.rosterSize,
                    totalCap: Math.min(t.totalCap, config.salaryCap),
                  };
                }
                return t;
              });

              const resolvedState = { ...state, teams: resolvedTeams };
              gateResult = gate(resolvedState);
            }
          }

          if (!gateResult.ok) {
            if (actor.isCommissioner && actor.forceAdvance) {
              log.warn(
                {
                  leagueId,
                  blockers: gateResult.blockers,
                  reason: actor.overrideReason,
                },
                "commissioner override: force-advancing past blockers",
              );

              return await deps.txRunner.run(async (tx) => {
                const isRollover = next.phase === "offseason_review" &&
                  clock.phase === "offseason_rollover";
                if (isRollover) {
                  await deps.repo.expireContracts(
                    leagueId,
                    clock.seasonYear,
                    tx,
                  );
                  await deps.repo.rollCapForward(
                    leagueId,
                    config.capGrowthRate,
                    tx,
                  );
                  await deps.repo.incrementSeasonYear(leagueId, tx);
                }

                return await deps.repo.writeClock(
                  {
                    leagueId,
                    seasonYear: isRollover
                      ? clock.seasonYear + 1
                      : clock.seasonYear,
                    phase: next.phase,
                    stepIndex: next.stepIndex,
                    advancedByUserId: actor.userId,
                    overrideReason: actor.overrideReason ??
                      "Commissioner override",
                    overrideBlockers: gateResult.ok
                      ? null
                      : gateResult.blockers,
                  },
                  tx,
                );
              });
            }

            const blockerSummary =
              (gateResult as { ok: false; blockers: Blocker[] })
                .blockers.map((b) => `${b.teamId}: ${b.reason}`)
                .join("; ");
            throw new DomainError(
              "PRECONDITION_FAILED",
              `Advance blocked: ${blockerSummary}`,
            );
          }
        }
      }

      const isRollover = next.phase === "offseason_review" &&
        clock.phase === "offseason_rollover";

      return await deps.txRunner.run(async (tx) => {
        if (isRollover) {
          const config = await deps.getLeagueConfig(leagueId);
          await deps.repo.expireContracts(leagueId, clock.seasonYear, tx);
          await deps.repo.rollCapForward(leagueId, config.capGrowthRate, tx);
          await deps.repo.incrementSeasonYear(leagueId, tx);
        }

        return await deps.repo.writeClock(
          {
            leagueId,
            seasonYear: isRollover ? clock.seasonYear + 1 : clock.seasonYear,
            phase: next.phase,
            stepIndex: next.stepIndex,
            advancedByUserId: actor.userId,
          },
          tx,
        );
      });
    },
  };
}
