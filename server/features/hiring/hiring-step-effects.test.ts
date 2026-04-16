import { assertEquals } from "@std/assert";
import pino from "pino";
import { createHiringStepEffects } from "./hiring-step-effects.ts";

function silentLog() {
  return pino({ level: "silent" });
}

interface Call {
  method: string;
  args: unknown;
}

function stubs() {
  const calls: Call[] = [];
  const hiringService = {
    openMarket: (leagueId: string) => {
      calls.push({ method: "openMarket", args: { leagueId } });
      return Promise.resolve();
    },
    resolveInterviewDeclines: (leagueId: string, stepSlug: string) => {
      calls.push({
        method: "resolveInterviewDeclines",
        args: { leagueId, stepSlug },
      });
      return Promise.resolve([]);
    },
    resolveDecisions: (leagueId: string, wave: number) => {
      calls.push({ method: "resolveDecisions", args: { leagueId, wave } });
      return Promise.resolve([]);
    },
    finalize: (leagueId: string) => {
      calls.push({ method: "finalize", args: { leagueId } });
      return Promise.resolve({ decisions: [], blockers: [] });
    },
  };
  const npcAi = {
    executeNpcInterest: (input: {
      leagueId: string;
      npcTeamIds: readonly string[];
      stepSlug: string;
    }) => {
      calls.push({ method: "executeNpcInterest", args: input });
      return Promise.resolve([]);
    },
    executeNpcInterviews: (input: {
      leagueId: string;
      npcTeamIds: readonly string[];
      stepSlug: string;
    }) => {
      calls.push({ method: "executeNpcInterviews", args: input });
      return Promise.resolve([]);
    },
    executeNpcOffers: (input: {
      leagueId: string;
      npcTeamIds: readonly string[];
      stepSlug: string;
    }) => {
      calls.push({ method: "executeNpcOffers", args: input });
      return Promise.resolve([]);
    },
  };
  return { calls, hiringService, npcAi };
}

function makeEffects(opts?: {
  poolAlreadyGenerated?: boolean;
  npcTeamIds?: string[];
}) {
  const s = stubs();
  const effects = createHiringStepEffects({
    hiringService: s.hiringService,
    npcAi: s.npcAi,
    listNpcTeamIds: () =>
      Promise.resolve(opts?.npcTeamIds ?? ["npc-a", "npc-b"]),
    hasGeneratedPool: () =>
      Promise.resolve(opts?.poolAlreadyGenerated ?? false),
    log: silentLog(),
  });
  return { ...s, effects };
}

function methods(calls: Call[]): string[] {
  return calls.map((c) => c.method);
}

Deno.test("onTransition: coaching_firings -> hiring_market_survey opens market", async () => {
  const { effects, calls } = makeEffects();
  await effects.onTransition({
    leagueId: "lg",
    prevStepSlug: "coaching_firings",
    nextStepSlug: "hiring_market_survey",
  });
  assertEquals(methods(calls), ["openMarket"]);
  assertEquals(calls[0].args, { leagueId: "lg" });
});

Deno.test("onTransition: market_survey -> interview_1 runs NPC interest", async () => {
  const { effects, calls } = makeEffects();
  await effects.onTransition({
    leagueId: "lg",
    prevStepSlug: "hiring_market_survey",
    nextStepSlug: "hiring_interview_1",
  });
  assertEquals(methods(calls), ["executeNpcInterest"]);
  assertEquals(calls[0].args, {
    leagueId: "lg",
    npcTeamIds: ["npc-a", "npc-b"],
    stepSlug: "hiring_market_survey",
  });
});

Deno.test("onTransition: interview_1 -> interview_2 runs NPC interviews + resolves declines", async () => {
  const { effects, calls } = makeEffects();
  await effects.onTransition({
    leagueId: "lg",
    prevStepSlug: "hiring_interview_1",
    nextStepSlug: "hiring_interview_2",
  });
  assertEquals(methods(calls), [
    "executeNpcInterviews",
    "resolveInterviewDeclines",
  ]);
  assertEquals(
    (calls[0].args as { stepSlug: string }).stepSlug,
    "hiring_interview_1",
  );
  assertEquals(calls[1].args, {
    leagueId: "lg",
    stepSlug: "hiring_interview_1",
  });
});

Deno.test("onTransition: interview_2 -> offers runs NPC interviews + declines for interview_2", async () => {
  const { effects, calls } = makeEffects();
  await effects.onTransition({
    leagueId: "lg",
    prevStepSlug: "hiring_interview_2",
    nextStepSlug: "hiring_offers",
  });
  assertEquals(methods(calls), [
    "executeNpcInterviews",
    "resolveInterviewDeclines",
  ]);
  assertEquals(
    (calls[0].args as { stepSlug: string }).stepSlug,
    "hiring_interview_2",
  );
  assertEquals(
    (calls[1].args as { stepSlug: string }).stepSlug,
    "hiring_interview_2",
  );
});

Deno.test("onTransition: offers -> decisions runs NPC offers", async () => {
  const { effects, calls } = makeEffects();
  await effects.onTransition({
    leagueId: "lg",
    prevStepSlug: "hiring_offers",
    nextStepSlug: "hiring_decisions",
  });
  assertEquals(methods(calls), ["executeNpcOffers"]);
  assertEquals(
    (calls[0].args as { stepSlug: string }).stepSlug,
    "hiring_offers",
  );
});

Deno.test("onTransition: decisions -> second_wave_interview resolves wave 1", async () => {
  const { effects, calls } = makeEffects();
  await effects.onTransition({
    leagueId: "lg",
    prevStepSlug: "hiring_decisions",
    nextStepSlug: "hiring_second_wave_interview",
  });
  assertEquals(methods(calls), ["resolveDecisions"]);
  assertEquals(calls[0].args, { leagueId: "lg", wave: 1 });
});

Deno.test("onTransition: second_wave_interview -> second_wave_decisions runs interviews, declines, offers", async () => {
  const { effects, calls } = makeEffects();
  await effects.onTransition({
    leagueId: "lg",
    prevStepSlug: "hiring_second_wave_interview",
    nextStepSlug: "hiring_second_wave_decisions",
  });
  assertEquals(methods(calls), [
    "executeNpcInterviews",
    "resolveInterviewDeclines",
    "executeNpcOffers",
  ]);
  for (const c of calls) {
    assertEquals(
      (c.args as { stepSlug: string }).stepSlug,
      "hiring_second_wave_interview",
    );
  }
});

Deno.test("onTransition: second_wave_decisions -> finalization resolves wave 2", async () => {
  const { effects, calls } = makeEffects();
  await effects.onTransition({
    leagueId: "lg",
    prevStepSlug: "hiring_second_wave_decisions",
    nextStepSlug: "hiring_finalization",
  });
  assertEquals(methods(calls), ["resolveDecisions"]);
  assertEquals(calls[0].args, { leagueId: "lg", wave: 2 });
});

Deno.test("onTransition: leaving finalization runs finalize", async () => {
  const { effects, calls } = makeEffects();
  await effects.onTransition({
    leagueId: "lg",
    prevStepSlug: "hiring_finalization",
    nextStepSlug: "generate_founding_player_pool",
  });
  assertEquals(methods(calls), ["finalize"]);
});

Deno.test("onTransition: unrelated transition is a no-op", async () => {
  const { effects, calls } = makeEffects();
  await effects.onTransition({
    leagueId: "lg",
    prevStepSlug: "coaching_firings",
    nextStepSlug: "coaching_firings",
  });
  await effects.onTransition({
    leagueId: "lg",
    prevStepSlug: "unrelated_step",
    nextStepSlug: "another_step",
  });
  assertEquals(calls, []);
});

Deno.test("onTransition: skips openMarket when a pool is already generated", async () => {
  const { effects, calls } = makeEffects({ poolAlreadyGenerated: true });
  await effects.onTransition({
    leagueId: "lg",
    prevStepSlug: "coaching_firings",
    nextStepSlug: "hiring_market_survey",
  });
  assertEquals(calls, []);
});

Deno.test("onTransition: skips NPC steps when no NPC teams are present", async () => {
  const { effects, calls } = makeEffects({ npcTeamIds: [] });
  await effects.onTransition({
    leagueId: "lg",
    prevStepSlug: "hiring_market_survey",
    nextStepSlug: "hiring_interview_1",
  });
  assertEquals(calls, []);
});
