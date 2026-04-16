export const LEAGUE_PHASES = [
  "initial_staff_hiring",
  "initial_pool",
  "initial_scouting",
  "initial_draft",
  "initial_free_agency",
  "initial_kickoff",
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

export type LeaguePhase = (typeof LEAGUE_PHASES)[number];
