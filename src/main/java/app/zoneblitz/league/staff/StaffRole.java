package app.zoneblitz.league.staff;

/** Terminal staff role on a franchise org chart. See {@code docs/technical/league-phases.md}. */
public enum StaffRole {
  HEAD_COACH("Head Coach"),
  OFFENSIVE_COORDINATOR("Offensive Coordinator"),
  DEFENSIVE_COORDINATOR("Defensive Coordinator"),
  SPECIAL_TEAMS_COORDINATOR("Special Teams Coordinator"),
  QB_COACH("Quarterbacks Coach"),
  RB_COACH("Running Backs Coach"),
  WR_COACH("Wide Receivers Coach"),
  TE_COACH("Tight Ends Coach"),
  OL_COACH("Offensive Line Coach"),
  DL_COACH("Defensive Line Coach"),
  EDGE_COACH("Edge Rushers Coach"),
  LB_COACH("Linebackers Coach"),
  DB_COACH("Defensive Backs Coach"),
  DIRECTOR_OF_SCOUTING("Director of Scouting"),
  COLLEGE_SCOUT("College Scout"),
  PRO_SCOUT("Pro Scout");

  private final String displayName;

  StaffRole(String displayName) {
    this.displayName = displayName;
  }

  public String displayName() {
    return displayName;
  }
}
