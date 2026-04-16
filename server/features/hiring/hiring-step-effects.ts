import type pino from "pino";
import type { HiringService } from "./hiring.service.ts";
import type { NpcHiringAi } from "./npc-hiring-ai.ts";

export interface HiringStepEffects {
  onTransition(input: {
    leagueId: string;
    prevStepSlug: string;
    nextStepSlug: string;
  }): Promise<void>;
}

type HiringServiceSubset = Pick<
  HiringService,
  "openMarket" | "resolveInterviewDeclines" | "resolveDecisions" | "finalize"
>;

export interface HiringStepEffectsDeps {
  hiringService: HiringServiceSubset;
  npcAi: NpcHiringAi;
  listNpcTeamIds: (leagueId: string) => Promise<string[]>;
  hasGeneratedPool: (leagueId: string) => Promise<boolean>;
  log: pino.Logger;
}

type InterviewDeclineStep =
  | "hiring_interview_1"
  | "hiring_interview_2"
  | "hiring_second_wave_interview";

export function createHiringStepEffects(
  deps: HiringStepEffectsDeps,
): HiringStepEffects {
  const log = deps.log.child({ module: "hiring.stepEffects" });

  async function runOpenMarket(leagueId: string): Promise<void> {
    if (await deps.hasGeneratedPool(leagueId)) {
      log.debug({ leagueId }, "skipping openMarket: pool already generated");
      return;
    }
    await deps.hiringService.openMarket(leagueId);
  }

  async function runNpcInterest(
    leagueId: string,
    stepSlug: string,
  ): Promise<void> {
    const npcTeamIds = await deps.listNpcTeamIds(leagueId);
    if (npcTeamIds.length === 0) return;
    await deps.npcAi.executeNpcInterest({ leagueId, npcTeamIds, stepSlug });
  }

  async function runNpcInterviewsAndDeclines(
    leagueId: string,
    stepSlug: InterviewDeclineStep,
  ): Promise<void> {
    const npcTeamIds = await deps.listNpcTeamIds(leagueId);
    if (npcTeamIds.length === 0) return;
    await deps.npcAi.executeNpcInterviews({ leagueId, npcTeamIds, stepSlug });
    await deps.hiringService.resolveInterviewDeclines(leagueId, stepSlug);
  }

  async function runNpcOffers(
    leagueId: string,
    stepSlug: string,
  ): Promise<void> {
    const npcTeamIds = await deps.listNpcTeamIds(leagueId);
    if (npcTeamIds.length === 0) return;
    await deps.npcAi.executeNpcOffers({ leagueId, npcTeamIds, stepSlug });
  }

  return {
    async onTransition({ leagueId, prevStepSlug, nextStepSlug }) {
      log.debug({ leagueId, prevStepSlug, nextStepSlug }, "hiring transition");

      if (
        prevStepSlug === "coaching_firings" &&
        nextStepSlug === "hiring_market_survey"
      ) {
        await runOpenMarket(leagueId);
        return;
      }

      if (
        prevStepSlug === "hiring_market_survey" &&
        nextStepSlug === "hiring_interview_1"
      ) {
        await runNpcInterest(leagueId, prevStepSlug);
        return;
      }

      if (
        prevStepSlug === "hiring_interview_1" &&
        nextStepSlug === "hiring_interview_2"
      ) {
        await runNpcInterviewsAndDeclines(leagueId, "hiring_interview_1");
        return;
      }

      if (
        prevStepSlug === "hiring_interview_2" &&
        nextStepSlug === "hiring_offers"
      ) {
        await runNpcInterviewsAndDeclines(leagueId, "hiring_interview_2");
        return;
      }

      if (
        prevStepSlug === "hiring_offers" &&
        nextStepSlug === "hiring_decisions"
      ) {
        await runNpcOffers(leagueId, prevStepSlug);
        return;
      }

      if (
        prevStepSlug === "hiring_decisions" &&
        nextStepSlug === "hiring_second_wave_interview"
      ) {
        await deps.hiringService.resolveDecisions(leagueId, 1);
        return;
      }

      if (
        prevStepSlug === "hiring_second_wave_interview" &&
        nextStepSlug === "hiring_second_wave_decisions"
      ) {
        const stepSlug: InterviewDeclineStep = "hiring_second_wave_interview";
        const npcTeamIds = await deps.listNpcTeamIds(leagueId);
        if (npcTeamIds.length === 0) return;
        await deps.npcAi.executeNpcInterviews({
          leagueId,
          npcTeamIds,
          stepSlug,
        });
        await deps.hiringService.resolveInterviewDeclines(leagueId, stepSlug);
        await deps.npcAi.executeNpcOffers({ leagueId, npcTeamIds, stepSlug });
        return;
      }

      if (
        prevStepSlug === "hiring_second_wave_decisions" &&
        nextStepSlug === "hiring_finalization"
      ) {
        await deps.hiringService.resolveDecisions(leagueId, 2);
        return;
      }

      if (prevStepSlug === "hiring_finalization") {
        await deps.hiringService.finalize(leagueId);
        return;
      }
    },
  };
}
