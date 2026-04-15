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
    flavorDate: "Feb 8",
  },
  {
    phase: "offseason_review",
    stepIndex: 1,
    slug: "end_of_year_recap",
    kind: "event",
    flavorDate: "Feb 10",
  },

  // coaching_carousel
  {
    phase: "coaching_carousel",
    stepIndex: 0,
    slug: "coaching_firings",
    kind: "event",
    flavorDate: "Feb 12",
  },
  {
    phase: "coaching_carousel",
    stepIndex: 1,
    slug: "coaching_hires",
    kind: "event",
    flavorDate: "Feb 18",
  },

  // tag_window
  {
    phase: "tag_window",
    stepIndex: 0,
    slug: "tag_window_open",
    kind: "event",
    flavorDate: "Feb 20",
  },
  {
    phase: "tag_window",
    stepIndex: 1,
    slug: "tag_deadline",
    kind: "event",
    flavorDate: "Mar 4",
  },

  // restricted_fa
  {
    phase: "restricted_fa",
    stepIndex: 0,
    slug: "rfa_tender_deadline",
    kind: "event",
    flavorDate: "Mar 5",
  },
  {
    phase: "restricted_fa",
    stepIndex: 1,
    slug: "rfa_matching_window",
    kind: "window",
    flavorDate: "Mar 5 – Mar 11",
  },

  // legal_tampering
  {
    phase: "legal_tampering",
    stepIndex: 0,
    slug: "legal_tampering_window",
    kind: "window",
    flavorDate: "Mar 11 – Mar 13",
  },

  // free_agency
  {
    phase: "free_agency",
    stepIndex: 0,
    slug: "fa_opens",
    kind: "event",
    flavorDate: "Mar 13",
  },
  {
    phase: "free_agency",
    stepIndex: 1,
    slug: "cap_compliance_deadline",
    kind: "event",
    flavorDate: "Mar 15",
  },

  // pre_draft
  {
    phase: "pre_draft",
    stepIndex: 0,
    slug: "combine_recap",
    kind: "event",
    flavorDate: "Apr 1",
  },
  {
    phase: "pre_draft",
    stepIndex: 1,
    slug: "pro_days",
    kind: "event",
    flavorDate: "Apr 10",
  },

  // draft (7 rounds)
  {
    phase: "draft",
    stepIndex: 0,
    slug: "round_1",
    kind: "event",
    flavorDate: "Apr 24",
  },
  {
    phase: "draft",
    stepIndex: 1,
    slug: "round_2",
    kind: "event",
    flavorDate: "Apr 25",
  },
  {
    phase: "draft",
    stepIndex: 2,
    slug: "round_3",
    kind: "event",
    flavorDate: "Apr 25",
  },
  {
    phase: "draft",
    stepIndex: 3,
    slug: "round_4",
    kind: "event",
    flavorDate: "Apr 26",
  },
  {
    phase: "draft",
    stepIndex: 4,
    slug: "round_5",
    kind: "event",
    flavorDate: "Apr 26",
  },
  {
    phase: "draft",
    stepIndex: 5,
    slug: "round_6",
    kind: "event",
    flavorDate: "Apr 26",
  },
  {
    phase: "draft",
    stepIndex: 6,
    slug: "round_7",
    kind: "event",
    flavorDate: "Apr 26",
  },

  // udfa
  {
    phase: "udfa",
    stepIndex: 0,
    slug: "udfa_window",
    kind: "window",
    flavorDate: "Apr 27 – May 3",
  },

  // offseason_program
  {
    phase: "offseason_program",
    stepIndex: 0,
    slug: "offseason_program_window",
    kind: "window",
    flavorDate: "May – Jul",
  },

  // preseason
  {
    phase: "preseason",
    stepIndex: 0,
    slug: "preseason_week_1",
    kind: "week",
    flavorDate: "Aug 7",
  },
  {
    phase: "preseason",
    stepIndex: 1,
    slug: "preseason_week_2",
    kind: "week",
    flavorDate: "Aug 14",
  },
  {
    phase: "preseason",
    stepIndex: 2,
    slug: "preseason_week_3",
    kind: "week",
    flavorDate: "Aug 21",
  },
  {
    phase: "preseason",
    stepIndex: 3,
    slug: "final_cuts",
    kind: "event",
    flavorDate: "Aug 27",
  },

  // regular_season (18 weeks + trade deadline)
  {
    phase: "regular_season",
    stepIndex: 0,
    slug: "week_1",
    kind: "week",
    flavorDate: "Sep 7",
  },
  {
    phase: "regular_season",
    stepIndex: 1,
    slug: "week_2",
    kind: "week",
    flavorDate: "Sep 14",
  },
  {
    phase: "regular_season",
    stepIndex: 2,
    slug: "week_3",
    kind: "week",
    flavorDate: "Sep 21",
  },
  {
    phase: "regular_season",
    stepIndex: 3,
    slug: "week_4",
    kind: "week",
    flavorDate: "Sep 28",
  },
  {
    phase: "regular_season",
    stepIndex: 4,
    slug: "week_5",
    kind: "week",
    flavorDate: "Oct 5",
  },
  {
    phase: "regular_season",
    stepIndex: 5,
    slug: "week_6",
    kind: "week",
    flavorDate: "Oct 12",
  },
  {
    phase: "regular_season",
    stepIndex: 6,
    slug: "week_7",
    kind: "week",
    flavorDate: "Oct 19",
  },
  {
    phase: "regular_season",
    stepIndex: 7,
    slug: "week_8",
    kind: "week",
    flavorDate: "Oct 26",
  },
  {
    phase: "regular_season",
    stepIndex: 8,
    slug: "trade_deadline",
    kind: "event",
    flavorDate: "Nov 1",
  },
  {
    phase: "regular_season",
    stepIndex: 9,
    slug: "week_9",
    kind: "week",
    flavorDate: "Nov 2",
  },
  {
    phase: "regular_season",
    stepIndex: 10,
    slug: "week_10",
    kind: "week",
    flavorDate: "Nov 9",
  },
  {
    phase: "regular_season",
    stepIndex: 11,
    slug: "week_11",
    kind: "week",
    flavorDate: "Nov 16",
  },
  {
    phase: "regular_season",
    stepIndex: 12,
    slug: "week_12",
    kind: "week",
    flavorDate: "Nov 23",
  },
  {
    phase: "regular_season",
    stepIndex: 13,
    slug: "week_13",
    kind: "week",
    flavorDate: "Nov 30",
  },
  {
    phase: "regular_season",
    stepIndex: 14,
    slug: "week_14",
    kind: "week",
    flavorDate: "Dec 7",
  },
  {
    phase: "regular_season",
    stepIndex: 15,
    slug: "week_15",
    kind: "week",
    flavorDate: "Dec 14",
  },
  {
    phase: "regular_season",
    stepIndex: 16,
    slug: "week_16",
    kind: "week",
    flavorDate: "Dec 21",
  },
  {
    phase: "regular_season",
    stepIndex: 17,
    slug: "week_17",
    kind: "week",
    flavorDate: "Dec 28",
  },
  {
    phase: "regular_season",
    stepIndex: 18,
    slug: "week_18",
    kind: "week",
    flavorDate: "Jan 4",
  },

  // playoffs
  {
    phase: "playoffs",
    stepIndex: 0,
    slug: "wild_card",
    kind: "week",
    flavorDate: "Jan 11",
  },
  {
    phase: "playoffs",
    stepIndex: 1,
    slug: "divisional",
    kind: "week",
    flavorDate: "Jan 18",
  },
  {
    phase: "playoffs",
    stepIndex: 2,
    slug: "conference",
    kind: "week",
    flavorDate: "Jan 25",
  },
  {
    phase: "playoffs",
    stepIndex: 3,
    slug: "super_bowl",
    kind: "week",
    flavorDate: "Feb 2",
  },

  // offseason_rollover
  {
    phase: "offseason_rollover",
    stepIndex: 0,
    slug: "contract_expirations",
    kind: "event",
    flavorDate: "Feb 5",
  },
  {
    phase: "offseason_rollover",
    stepIndex: 1,
    slug: "cap_rollover",
    kind: "event",
    flavorDate: "Feb 6",
  },
  {
    phase: "offseason_rollover",
    stepIndex: 2,
    slug: "season_advance",
    kind: "event",
    flavorDate: "Feb 7",
  },
];
