import type { CoachRole, ScoutRole } from "@zone-blitz/shared";

export const COACH_ROLE_LABELS: Record<CoachRole, string> = {
  HC: "Head Coach",
  OC: "Offensive Coordinator",
  DC: "Defensive Coordinator",
  STC: "Special Teams Coordinator",
  QB: "Quarterbacks Coach",
  RB: "Running Backs Coach",
  WR: "Wide Receivers Coach",
  TE: "Tight Ends Coach",
  OL: "Offensive Line Coach",
  DL: "Defensive Line Coach",
  LB: "Linebackers Coach",
  DB: "Defensive Backs Coach",
  ST_ASSISTANT: "Special Teams Assistant",
};

export const SCOUT_ROLE_LABELS: Record<ScoutRole, string> = {
  DIRECTOR: "Director of Scouting",
  NATIONAL_CROSS_CHECKER: "National Cross-Checker",
  AREA_SCOUT: "Area Scout",
};

export function roleLabel(
  staffType: "coach" | "scout",
  role: string,
): string {
  if (staffType === "coach") {
    return COACH_ROLE_LABELS[role as CoachRole] ?? role;
  }
  return SCOUT_ROLE_LABELS[role as ScoutRole] ?? role;
}

const COACH_BACKGROUND_LABELS: Record<string, string> = {
  offense: "Offensive background",
  defense: "Defensive background",
  ceo: "CEO / manager",
  special_teams: "Special teams background",
  quarterbacks: "Quarterbacks background",
  running_backs: "Running backs background",
  wide_receivers: "Wide receivers background",
  tight_ends: "Tight ends background",
  offensive_line: "Offensive line background",
  defensive_line: "Defensive line background",
  linebackers: "Linebackers background",
  defensive_backs: "Defensive backs background",
};

/**
 * The "Background" column on the coach hiring tab. Surfaces public
 * knowledge: the side of the ball or position group this coach
 * built his career on. Driven entirely by `specialty` so HC, OC, DC,
 * and position coaches all map through the same table.
 */
export function coachBackgroundLabel(specialty: string | null): string {
  if (!specialty) return "—";
  return COACH_BACKGROUND_LABELS[specialty] ?? "—";
}
