package app.zoneblitz.gamesimulator.playcalling;

/**
 * Defensive personnel package — how many DBs vs LBs are on the field. Distinct from specific player
 * identity (that's {@link app.zoneblitz.gamesimulator.personnel.DefensivePersonnel}); this is the
 * pre-snap grouping signal.
 */
public enum DefensivePackage {
  /** 4 DBs — traditional base against 21/22 personnel. */
  BASE,
  /** 5 DBs — modern default vs 11 personnel. */
  NICKEL,
  /** 6 DBs — pass-down / 3rd-and-long. */
  DIME,
  /** 7 DBs — prevent / end-of-half. */
  QUARTER,
  /** Extra DL/LB, short-yardage / goal-line. */
  GOAL_LINE
}
