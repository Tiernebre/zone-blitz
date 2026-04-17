/**
 * The position groups a coach's career or a scout's evaluation focus
 * can be anchored to. Deliberately coarse — these are the tl;dr labels
 * shown on the hiring market table, not the full player-position
 * taxonomy. `GENERALIST` covers coaches without a single position home
 * (CEO HCs, ATHLETE scouts) and scouts who work across every position.
 *
 * Kept in shared so the coaches/scouts generators and the hiring UI
 * agree on the same vocabulary.
 */

export const POSITION_GROUPS = [
  "QB",
  "RB",
  "WR",
  "TE",
  "OL",
  "DL",
  "LB",
  "DB",
  "ST",
  "GENERALIST",
] as const;

export type PositionGroup = typeof POSITION_GROUPS[number];

const POSITION_GROUP_LABELS: Record<PositionGroup, string> = {
  QB: "Quarterbacks",
  RB: "Running Backs",
  WR: "Wide Receivers",
  TE: "Tight Ends",
  OL: "Offensive Line",
  DL: "Defensive Line",
  LB: "Linebackers",
  DB: "Defensive Backs",
  ST: "Special Teams",
  GENERALIST: "Generalist",
};

export function positionGroupLabel(value: string | null): string | null {
  if (!value) return null;
  return POSITION_GROUP_LABELS[value as PositionGroup] ?? value;
}

/**
 * Regions a scout's network is strongest in. Directors inherit one of
 * these too — a director who spent 15 years covering the Southeast
 * brings that network with them even after they move into the corner
 * office. `NATIONAL` is the label for directors/CCs who genuinely
 * worked across every region.
 */
export const SCOUT_REGIONS = [
  "NORTHEAST",
  "SOUTHEAST",
  "MIDWEST",
  "WEST",
  "NATIONAL",
] as const;

export type ScoutRegion = typeof SCOUT_REGIONS[number];

const SCOUT_REGION_LABELS: Record<ScoutRegion, string> = {
  NORTHEAST: "Northeast",
  SOUTHEAST: "Southeast",
  MIDWEST: "Midwest",
  WEST: "West Coast",
  NATIONAL: "National",
};

export function scoutRegionLabel(value: string | null): string | null {
  if (!value) return null;
  return SCOUT_REGION_LABELS[value as ScoutRegion] ?? value;
}
