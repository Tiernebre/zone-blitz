import { deriveDefaultSeasonLength } from "@zone-blitz/shared";

const MVP_FRANCHISE_COUNT = 8;

export const LEAGUE_SETTINGS_DEFAULTS = {
  seasonLength: deriveDefaultSeasonLength(MVP_FRANCHISE_COUNT),
  conferences: 1,
  divisionsPerConference: 2,
  rosterSize: 53,
  salaryCap: 255_000_000,
  salaryFloor: Math.round(255_000_000 * 0.89),
  draftRounds: 7,
} as const;
