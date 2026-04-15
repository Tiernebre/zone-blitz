import type { NeutralBucket } from "../archetypes/neutral-bucket.ts";

export interface StatColumnDefinition {
  key: string;
  label: string;
}

const PASSING_COLUMNS: StatColumnDefinition[] = [
  { key: "completions", label: "CMP" },
  { key: "attempts", label: "ATT" },
  { key: "completionPercentage", label: "CMP%" },
  { key: "passingYards", label: "YDS" },
  { key: "passingTouchdowns", label: "TD" },
  { key: "interceptions", label: "INT" },
  { key: "passerRating", label: "RTG" },
];

const RUSHING_COLUMNS: StatColumnDefinition[] = [
  { key: "rushingAttempts", label: "ATT" },
  { key: "rushingYards", label: "YDS" },
  { key: "yardsPerCarry", label: "YPC" },
  { key: "rushingTouchdowns", label: "TD" },
  { key: "fumbles", label: "FUM" },
];

const RECEIVING_COLUMNS: StatColumnDefinition[] = [
  { key: "targets", label: "TGT" },
  { key: "receptions", label: "REC" },
  { key: "receivingYards", label: "YDS" },
  { key: "yardsPerReception", label: "Y/R" },
  { key: "receivingTouchdowns", label: "TD" },
];

const DEFENSIVE_COLUMNS: StatColumnDefinition[] = [
  { key: "tackles", label: "TKL" },
  { key: "sacks", label: "SCK" },
  { key: "tacklesForLoss", label: "TFL" },
  { key: "interceptions", label: "INT" },
  { key: "passDefenses", label: "PD" },
  { key: "forcedFumbles", label: "FF" },
];

const KICKING_COLUMNS: StatColumnDefinition[] = [
  { key: "fieldGoalsMade", label: "FGM" },
  { key: "fieldGoalsAttempted", label: "FGA" },
  { key: "fieldGoalPercentage", label: "FG%" },
  { key: "extraPointsMade", label: "XPM" },
  { key: "extraPointsAttempted", label: "XPA" },
];

const PUNTING_COLUMNS: StatColumnDefinition[] = [
  { key: "punts", label: "PUNTS" },
  { key: "puntingYards", label: "YDS" },
  { key: "puntingAverage", label: "AVG" },
  { key: "puntsInside20", label: "IN20" },
];

const BUCKET_COLUMNS: Record<NeutralBucket, StatColumnDefinition[]> = {
  QB: PASSING_COLUMNS,
  RB: RUSHING_COLUMNS,
  WR: RECEIVING_COLUMNS,
  TE: RECEIVING_COLUMNS,
  OT: [],
  IOL: [],
  EDGE: DEFENSIVE_COLUMNS,
  IDL: DEFENSIVE_COLUMNS,
  LB: DEFENSIVE_COLUMNS,
  CB: DEFENSIVE_COLUMNS,
  S: DEFENSIVE_COLUMNS,
  K: KICKING_COLUMNS,
  P: PUNTING_COLUMNS,
  LS: [],
};

export function statColumnsForBucket(
  bucket: NeutralBucket,
): StatColumnDefinition[] {
  return BUCKET_COLUMNS[bucket];
}
