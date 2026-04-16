import { assertEquals } from "@std/assert";
import { DEFAULT_PHASE_STEPS } from "./default-phase-steps.ts";

const ALL_PHASES = [
  "genesis_staff_hiring",
  "genesis_founding_pool",
  "genesis_allocation_draft",
  "genesis_free_agency",
  "genesis_kickoff",
  "offseason_review",
  "coaching_carousel",
  "tag_window",
  "restricted_fa",
  "legal_tampering",
  "free_agency",
  "pre_draft",
  "draft",
  "udfa",
  "offseason_program",
  "preseason",
  "regular_season",
  "playoffs",
  "offseason_rollover",
] as const;

Deno.test("every phase has at least one step", () => {
  const phasesWithSteps = new Set(DEFAULT_PHASE_STEPS.map((s) => s.phase));
  for (const phase of ALL_PHASES) {
    assertEquals(
      phasesWithSteps.has(phase),
      true,
      `Phase "${phase}" has no steps`,
    );
  }
});

Deno.test("slugs are unique within each phase", () => {
  const slugsByPhase = new Map<string, string[]>();
  for (const step of DEFAULT_PHASE_STEPS) {
    const list = slugsByPhase.get(step.phase) ?? [];
    list.push(step.slug);
    slugsByPhase.set(step.phase, list);
  }
  for (const [phase, slugs] of slugsByPhase) {
    assertEquals(
      new Set(slugs).size,
      slugs.length,
      `Phase "${phase}" has duplicate slugs`,
    );
  }
});

Deno.test("stepIndex values are sequential within each phase starting at 0", () => {
  const byPhase = new Map<string, number[]>();
  for (const step of DEFAULT_PHASE_STEPS) {
    const list = byPhase.get(step.phase) ?? [];
    list.push(step.stepIndex);
    byPhase.set(step.phase, list);
  }
  for (const [phase, indices] of byPhase) {
    const sorted = [...indices].sort((a, b) => a - b);
    assertEquals(sorted[0], 0, `Phase "${phase}" does not start at 0`);
    for (let i = 1; i < sorted.length; i++) {
      assertEquals(
        sorted[i],
        sorted[i - 1] + 1,
        `Phase "${phase}" has non-sequential stepIndex at ${sorted[i]}`,
      );
    }
  }
});

Deno.test("kind is always event, week, or window", () => {
  const validKinds = new Set(["event", "week", "window"]);
  for (const step of DEFAULT_PHASE_STEPS) {
    assertEquals(
      validKinds.has(step.kind),
      true,
      `Step "${step.slug}" has invalid kind: ${step.kind}`,
    );
  }
});

Deno.test("contains expected deadline events", () => {
  const slugs = new Set(DEFAULT_PHASE_STEPS.map((s) => s.slug));
  const expectedDeadlines = [
    "tag_deadline",
    "rfa_tender_deadline",
    "final_cuts",
    "trade_deadline",
    "cap_compliance_deadline",
  ];
  for (const slug of expectedDeadlines) {
    assertEquals(slugs.has(slug), true, `Missing deadline event: ${slug}`);
  }
});

Deno.test("deadline events have kind 'event'", () => {
  const deadlineSlugs = new Set([
    "tag_deadline",
    "rfa_tender_deadline",
    "final_cuts",
    "trade_deadline",
    "cap_compliance_deadline",
  ]);
  for (const step of DEFAULT_PHASE_STEPS) {
    if (deadlineSlugs.has(step.slug)) {
      assertEquals(
        step.kind,
        "event",
        `Deadline "${step.slug}" should have kind 'event'`,
      );
    }
  }
});

Deno.test("draft has 7 rounds", () => {
  const draftSteps = DEFAULT_PHASE_STEPS.filter((s) => s.phase === "draft");
  const roundSlugs = draftSteps.filter((s) => s.slug.startsWith("round_"));
  assertEquals(roundSlugs.length, 7);
});

Deno.test("regular_season has 18 weeks", () => {
  const regSeasonSteps = DEFAULT_PHASE_STEPS.filter(
    (s) => s.phase === "regular_season",
  );
  const weekSteps = regSeasonSteps.filter((s) => s.slug.startsWith("week_"));
  assertEquals(weekSteps.length, 18);
});

Deno.test("regular_season weeks have kind 'week'", () => {
  const weekSteps = DEFAULT_PHASE_STEPS.filter(
    (s) => s.phase === "regular_season" && s.slug.startsWith("week_"),
  );
  for (const step of weekSteps) {
    assertEquals(
      step.kind,
      "week",
      `Week "${step.slug}" should have kind 'week'`,
    );
  }
});

Deno.test("playoffs has expected rounds", () => {
  const playoffSteps = DEFAULT_PHASE_STEPS.filter(
    (s) => s.phase === "playoffs",
  );
  const slugs = playoffSteps.map((s) => s.slug);
  assertEquals(slugs.includes("wild_card"), true);
  assertEquals(slugs.includes("divisional"), true);
  assertEquals(slugs.includes("conference"), true);
  assertEquals(slugs.includes("super_bowl"), true);
});

Deno.test("window phases exist", () => {
  const slugs = new Set(DEFAULT_PHASE_STEPS.map((s) => s.slug));
  assertEquals(slugs.has("legal_tampering_window"), true);
  assertEquals(slugs.has("udfa_window"), true);
  assertEquals(slugs.has("offseason_program_window"), true);
});

Deno.test("window steps have kind 'window'", () => {
  const windowSlugs = new Set([
    "legal_tampering_window",
    "udfa_window",
    "offseason_program_window",
  ]);
  for (const step of DEFAULT_PHASE_STEPS) {
    if (windowSlugs.has(step.slug)) {
      assertEquals(
        step.kind,
        "window",
        `"${step.slug}" should have kind 'window'`,
      );
    }
  }
});

Deno.test("all steps have non-empty slugs", () => {
  for (const step of DEFAULT_PHASE_STEPS) {
    assertEquals(step.slug.length > 0, true);
  }
});

Deno.test("each genesis phase has at least one step", () => {
  const genesisPhases = [
    "genesis_staff_hiring",
    "genesis_founding_pool",
    "genesis_allocation_draft",
    "genesis_free_agency",
    "genesis_kickoff",
  ];
  const phasesWithSteps = new Set(DEFAULT_PHASE_STEPS.map((s) => s.phase));
  for (const phase of genesisPhases) {
    assertEquals(
      phasesWithSteps.has(phase),
      true,
      `Genesis phase "${phase}" has no steps`,
    );
  }
});

Deno.test("genesis steps appear before recurring steps in the catalog", () => {
  const firstGenesisIdx = DEFAULT_PHASE_STEPS.findIndex((s) =>
    s.phase.startsWith("genesis_")
  );
  const firstRecurringIdx = DEFAULT_PHASE_STEPS.findIndex(
    (s) => s.phase === "offseason_review",
  );
  assertEquals(firstGenesisIdx < firstRecurringIdx, true);
});

const HIRING_STEP_SLUGS = [
  "hiring_market_survey",
  "hiring_interview_1",
  "hiring_interview_2",
  "hiring_offers",
  "hiring_decisions",
  "hiring_second_wave_interview",
  "hiring_second_wave_decisions",
  "hiring_finalization",
] as const;

Deno.test("genesis_staff_hiring has 8 hiring steps in the ADR 0032 order", () => {
  const steps = DEFAULT_PHASE_STEPS.filter(
    (s) => s.phase === "genesis_staff_hiring",
  ).sort((a, b) => a.stepIndex - b.stepIndex);
  assertEquals(steps.length, 8);
  for (let i = 0; i < HIRING_STEP_SLUGS.length; i++) {
    assertEquals(steps[i].stepIndex, i);
    assertEquals(steps[i].slug, HIRING_STEP_SLUGS[i]);
    assertEquals(steps[i].kind, "event");
  }
});

Deno.test("coaching_carousel has 9 steps: coaching_firings + 8 hiring steps", () => {
  const steps = DEFAULT_PHASE_STEPS.filter(
    (s) => s.phase === "coaching_carousel",
  ).sort((a, b) => a.stepIndex - b.stepIndex);
  assertEquals(steps.length, 9);

  assertEquals(steps[0].stepIndex, 0);
  assertEquals(steps[0].slug, "coaching_firings");
  assertEquals(steps[0].kind, "event");
  assertEquals(steps[0].flavorDate, "Feb 12");

  for (let i = 0; i < HIRING_STEP_SLUGS.length; i++) {
    const step = steps[i + 1];
    assertEquals(step.stepIndex, i + 1);
    assertEquals(step.slug, HIRING_STEP_SLUGS[i]);
    assertEquals(step.kind, "event");
    assertEquals(
      typeof step.flavorDate === "string" && step.flavorDate.length > 0,
      true,
      `coaching_carousel step "${step.slug}" is missing a flavor date`,
    );
  }
});

Deno.test("coaching_carousel hiring step flavor dates are monotonically ordered", () => {
  const steps = DEFAULT_PHASE_STEPS.filter(
    (s) => s.phase === "coaching_carousel",
  ).sort((a, b) => a.stepIndex - b.stepIndex);

  const monthOrder: Record<string, number> = { Feb: 2, Mar: 3 };
  const toOrdinal = (label: string): number => {
    const [month, day] = label.split(" ");
    return monthOrder[month] * 100 + Number(day);
  };

  for (let i = 1; i < steps.length; i++) {
    const prev = toOrdinal(steps[i - 1].flavorDate!);
    const curr = toOrdinal(steps[i].flavorDate!);
    assertEquals(
      curr >= prev,
      true,
      `step ${steps[i].slug} flavorDate ${steps[i].flavorDate} precedes ${
        steps[i - 1].flavorDate
      }`,
    );
  }
});

Deno.test("legacy single-step hiring slugs are removed from the catalog", () => {
  const slugs = new Set(DEFAULT_PHASE_STEPS.map((s) => s.slug));
  assertEquals(slugs.has("hire_initial_staff"), false);
  assertEquals(slugs.has("coaching_hires"), false);
});
