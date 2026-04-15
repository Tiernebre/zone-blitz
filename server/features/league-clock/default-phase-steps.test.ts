import { assertEquals } from "@std/assert";
import { DEFAULT_PHASE_STEPS } from "./default-phase-steps.ts";

const ALL_PHASES = [
  "genesis_charter",
  "genesis_franchise_establishment",
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

Deno.test("all slugs are unique", () => {
  const slugs = DEFAULT_PHASE_STEPS.map((s) => s.slug);
  assertEquals(new Set(slugs).size, slugs.length);
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
    "genesis_charter",
    "genesis_franchise_establishment",
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
