export interface DefaultPhaseStep {
  phase: string;
  stepIndex: number;
  slug: string;
  kind: "event" | "week" | "window";
  flavorDate?: string;
}

export const DEFAULT_PHASE_STEPS: DefaultPhaseStep[] = [
  // offseason_review
  {
    phase: "offseason_review",
    stepIndex: 0,
    slug: "awards_ceremony",
    kind: "event",
  },
  {
    phase: "offseason_review",
    stepIndex: 1,
    slug: "end_of_year_recap",
    kind: "event",
  },

  // coaching_carousel
  {
    phase: "coaching_carousel",
    stepIndex: 0,
    slug: "coaching_firings",
    kind: "event",
  },
  {
    phase: "coaching_carousel",
    stepIndex: 1,
    slug: "coaching_hires",
    kind: "event",
  },

  // tag_window
  { phase: "tag_window", stepIndex: 0, slug: "tag_window_open", kind: "event" },
  { phase: "tag_window", stepIndex: 1, slug: "tag_deadline", kind: "event" },

  // restricted_fa
  {
    phase: "restricted_fa",
    stepIndex: 0,
    slug: "rfa_tender_deadline",
    kind: "event",
  },
  {
    phase: "restricted_fa",
    stepIndex: 1,
    slug: "rfa_matching_window",
    kind: "window",
  },

  // legal_tampering
  {
    phase: "legal_tampering",
    stepIndex: 0,
    slug: "legal_tampering_window",
    kind: "window",
  },

  // free_agency
  { phase: "free_agency", stepIndex: 0, slug: "fa_opens", kind: "event" },
  {
    phase: "free_agency",
    stepIndex: 1,
    slug: "cap_compliance_deadline",
    kind: "event",
  },

  // pre_draft
  { phase: "pre_draft", stepIndex: 0, slug: "combine_recap", kind: "event" },
  { phase: "pre_draft", stepIndex: 1, slug: "pro_days", kind: "event" },

  // draft (7 rounds)
  { phase: "draft", stepIndex: 0, slug: "round_1", kind: "event" },
  { phase: "draft", stepIndex: 1, slug: "round_2", kind: "event" },
  { phase: "draft", stepIndex: 2, slug: "round_3", kind: "event" },
  { phase: "draft", stepIndex: 3, slug: "round_4", kind: "event" },
  { phase: "draft", stepIndex: 4, slug: "round_5", kind: "event" },
  { phase: "draft", stepIndex: 5, slug: "round_6", kind: "event" },
  { phase: "draft", stepIndex: 6, slug: "round_7", kind: "event" },

  // udfa
  { phase: "udfa", stepIndex: 0, slug: "udfa_window", kind: "window" },

  // offseason_program
  {
    phase: "offseason_program",
    stepIndex: 0,
    slug: "offseason_program_window",
    kind: "window",
  },

  // preseason
  { phase: "preseason", stepIndex: 0, slug: "preseason_week_1", kind: "week" },
  { phase: "preseason", stepIndex: 1, slug: "preseason_week_2", kind: "week" },
  { phase: "preseason", stepIndex: 2, slug: "preseason_week_3", kind: "week" },
  { phase: "preseason", stepIndex: 3, slug: "final_cuts", kind: "event" },

  // regular_season (18 weeks + trade deadline)
  { phase: "regular_season", stepIndex: 0, slug: "week_1", kind: "week" },
  { phase: "regular_season", stepIndex: 1, slug: "week_2", kind: "week" },
  { phase: "regular_season", stepIndex: 2, slug: "week_3", kind: "week" },
  { phase: "regular_season", stepIndex: 3, slug: "week_4", kind: "week" },
  { phase: "regular_season", stepIndex: 4, slug: "week_5", kind: "week" },
  { phase: "regular_season", stepIndex: 5, slug: "week_6", kind: "week" },
  { phase: "regular_season", stepIndex: 6, slug: "week_7", kind: "week" },
  { phase: "regular_season", stepIndex: 7, slug: "week_8", kind: "week" },
  {
    phase: "regular_season",
    stepIndex: 8,
    slug: "trade_deadline",
    kind: "event",
  },
  { phase: "regular_season", stepIndex: 9, slug: "week_9", kind: "week" },
  { phase: "regular_season", stepIndex: 10, slug: "week_10", kind: "week" },
  { phase: "regular_season", stepIndex: 11, slug: "week_11", kind: "week" },
  { phase: "regular_season", stepIndex: 12, slug: "week_12", kind: "week" },
  { phase: "regular_season", stepIndex: 13, slug: "week_13", kind: "week" },
  { phase: "regular_season", stepIndex: 14, slug: "week_14", kind: "week" },
  { phase: "regular_season", stepIndex: 15, slug: "week_15", kind: "week" },
  { phase: "regular_season", stepIndex: 16, slug: "week_16", kind: "week" },
  { phase: "regular_season", stepIndex: 17, slug: "week_17", kind: "week" },
  { phase: "regular_season", stepIndex: 18, slug: "week_18", kind: "week" },

  // playoffs
  { phase: "playoffs", stepIndex: 0, slug: "wild_card", kind: "week" },
  { phase: "playoffs", stepIndex: 1, slug: "divisional", kind: "week" },
  { phase: "playoffs", stepIndex: 2, slug: "conference", kind: "week" },
  { phase: "playoffs", stepIndex: 3, slug: "super_bowl", kind: "week" },

  // offseason_rollover
  {
    phase: "offseason_rollover",
    stepIndex: 0,
    slug: "contract_expirations",
    kind: "event",
  },
  {
    phase: "offseason_rollover",
    stepIndex: 1,
    slug: "cap_rollover",
    kind: "event",
  },
  {
    phase: "offseason_rollover",
    stepIndex: 2,
    slug: "season_advance",
    kind: "event",
  },
];
