import type { CoachSummary } from "./coach.ts";
import type { PlayerInjuryStatus, PlayerPosition } from "./player.ts";

export type PlayerPositionGroup = "offense" | "defense" | "special_teams";

export interface RosterPlayer {
  id: string;
  firstName: string;
  lastName: string;
  position: PlayerPosition;
  positionGroup: PlayerPositionGroup;
  age: number;
  capHit: number;
  contractYearsRemaining: number;
  injuryStatus: PlayerInjuryStatus;
}

export interface RosterPositionGroupSummary {
  group: PlayerPositionGroup;
  headcount: number;
  totalCap: number;
}

export interface ActiveRoster {
  leagueId: string;
  teamId: string;
  players: RosterPlayer[];
  positionGroups: RosterPositionGroupSummary[];
  totalCap: number;
  salaryCap: number;
  capSpace: number;
}

export interface DepthChartSlot {
  playerId: string;
  firstName: string;
  lastName: string;
  position: PlayerPosition;
  slotOrdinal: number;
  injuryStatus: PlayerInjuryStatus;
}

export interface DepthChartInactive {
  playerId: string;
  firstName: string;
  lastName: string;
  position: PlayerPosition;
  injuryStatus: PlayerInjuryStatus;
}

export interface DepthChart {
  leagueId: string;
  teamId: string;
  slots: DepthChartSlot[];
  inactives: DepthChartInactive[];
  lastUpdatedAt: string | null;
  lastUpdatedBy: CoachSummary | null;
}

export interface RosterStatisticsRow {
  playerId: string;
  firstName: string;
  lastName: string;
  position: PlayerPosition;
  positionGroup: PlayerPositionGroup;
  gamesPlayed: number;
}

export interface RosterStatistics {
  leagueId: string;
  teamId: string;
  seasonId: string | null;
  rows: RosterStatisticsRow[];
}
