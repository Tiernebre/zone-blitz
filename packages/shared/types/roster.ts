import type { NeutralBucket } from "../archetypes/neutral-bucket.ts";
import type { CoachSummary } from "./coach.ts";
import type { PlayerInjuryStatus } from "./player.ts";
import type { SchemeFitLabel } from "./scheme-fit.ts";
import type { DepthChartSlotDefinition } from "../depth-chart/vocabulary.ts";

export type NeutralBucketGroup = "offense" | "defense" | "special_teams";

export const NEUTRAL_BUCKET_GROUPS: Record<
  NeutralBucketGroup,
  readonly NeutralBucket[]
> = {
  offense: ["QB", "RB", "WR", "TE", "OT", "IOL"],
  defense: ["EDGE", "IDL", "LB", "CB", "S"],
  special_teams: ["K", "P", "LS"],
};

export function neutralBucketGroupOf(
  bucket: NeutralBucket,
): NeutralBucketGroup {
  for (const group of ["offense", "defense", "special_teams"] as const) {
    if (NEUTRAL_BUCKET_GROUPS[group].includes(bucket)) return group;
  }
  throw new Error(`Unknown group for neutral bucket ${bucket}`);
}

export interface RosterPlayer {
  id: string;
  firstName: string;
  lastName: string;
  neutralBucket: NeutralBucket;
  neutralBucketGroup: NeutralBucketGroup;
  age: number;
  capHit: number;
  contractYearsRemaining: number;
  injuryStatus: PlayerInjuryStatus;
  // Qualitative fit of this player against the team's current scheme
  // fingerprint (ADR 0005). `null` when the team has no OC and no DC
  // hired — nothing to fit against yet.
  schemeFit: SchemeFitLabel | null;
}

export interface RosterPositionGroupSummary {
  group: NeutralBucketGroup;
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
  slotCode: string;
  slotOrdinal: number;
  injuryStatus: PlayerInjuryStatus;
}

export interface DepthChartInactive {
  playerId: string;
  firstName: string;
  lastName: string;
  slotCode: string;
  injuryStatus: PlayerInjuryStatus;
}

export interface DepthChart {
  leagueId: string;
  teamId: string;
  vocabulary: DepthChartSlotDefinition[];
  slots: DepthChartSlot[];
  inactives: DepthChartInactive[];
  lastUpdatedAt: string | null;
  lastUpdatedBy: CoachSummary | null;
}

export interface RosterStatisticsRow {
  playerId: string;
  firstName: string;
  lastName: string;
  neutralBucket: NeutralBucket;
  neutralBucketGroup: NeutralBucketGroup;
  gamesPlayed: number;
}

export interface RosterStatistics {
  leagueId: string;
  teamId: string;
  seasonId: string | null;
  rows: RosterStatisticsRow[];
}
