import type { SeasonPhase } from "./season.ts";

export interface League {
  id: string;
  name: string;
  numberOfTeams: number;
  seasonLength: number;
  salaryCap: number;
  capFloorPercent: number;
  capGrowthRate: number;
  rosterSize: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeagueSeasonSummary {
  year: number;
  phase: SeasonPhase;
  week: number;
}

export interface LeagueListItem extends League {
  currentSeason: LeagueSeasonSummary | null;
}

export interface NewLeague {
  name: string;
}
