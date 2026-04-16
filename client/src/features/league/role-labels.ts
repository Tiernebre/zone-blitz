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

/**
 * The "Background" column on the coach hiring tab. Surfaces public
 * knowledge: which side of the ball this coach built his career on.
 * For HCs this comes from `specialty` (offense / defense / ceo). For
 * coordinators we derive it from the role itself so the column is
 * still meaningful during the coaching carousel.
 */
export function coachBackgroundLabel(
  role: string,
  specialty: string | null,
): string {
  if (role === "HC") {
    if (specialty === "offense") return "Offensive background";
    if (specialty === "defense") return "Defensive background";
    if (specialty === "ceo") return "CEO / manager";
    return "—";
  }
  if (role === "OC") return "Offense";
  if (role === "DC") return "Defense";
  if (role === "STC" || role === "ST_ASSISTANT") return "Special teams";
  if (role === "QB" || role === "RB" || role === "WR" || role === "TE") {
    return "Offense";
  }
  if (role === "OL") return "Offense";
  if (role === "DL" || role === "LB" || role === "DB") return "Defense";
  return "—";
}
