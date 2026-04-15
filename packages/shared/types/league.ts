import type { OffseasonStage, SeasonPhase } from "./season.ts";

export interface League {
  id: string;
  name: string;
  userTeamId: string | null;
  numberOfTeams: number;
  seasonLength: number;
  salaryCap: number;
  capFloorPercent: number;
  capGrowthRate: number;
  rosterSize: number;
  createdAt: Date;
  updatedAt: Date;
  lastPlayedAt: Date | null;
}

export interface LeagueSeasonSummary {
  year: number;
  phase: SeasonPhase;
  offseasonStage: OffseasonStage | null;
  week: number;
}

export interface LeagueUserTeamSummary {
  id: string;
  name: string;
  city: string;
  abbreviation: string;
  primaryColor: string;
}

export interface LeagueListItem extends League {
  currentSeason: LeagueSeasonSummary | null;
  userTeam: LeagueUserTeamSummary | null;
}

export interface NewLeague {
  name: string;
}
