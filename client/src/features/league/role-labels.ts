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

const COACH_ARCHETYPE_LABELS: Record<string, string> = {
  offense: "Offensive Oriented",
  defense: "Defensive Oriented",
  ceo: "On-Field CEO",
  special_teams: "Special Teams Oriented",
  quarterbacks: "Quarterbacks Oriented",
  running_backs: "Running Backs Oriented",
  wide_receivers: "Wide Receivers Oriented",
  tight_ends: "Tight Ends Oriented",
  offensive_line: "Offensive Line Oriented",
  defensive_line: "Defensive Line Oriented",
  linebackers: "Linebackers Oriented",
  defensive_backs: "Defensive Backs Oriented",
};

/**
 * The "Archetype" column on the coach hiring tab. Surfaces public
 * knowledge: the side of the ball or position group this coach
 * built his career on. Driven entirely by `specialty` so HC, OC, DC,
 * and position coaches all map through the same table.
 */
export function coachArchetypeLabel(specialty: string | null): string {
  if (!specialty) return "—";
  return COACH_ARCHETYPE_LABELS[specialty] ?? "—";
}
