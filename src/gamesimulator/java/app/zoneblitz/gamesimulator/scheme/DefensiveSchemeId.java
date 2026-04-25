package app.zoneblitz.gamesimulator.scheme;

/**
 * Stable identifier for a defensive scheme. Coverage- or front-flavored — Fangio (two-high light
 * box), Buddy Ryan 46 (heavy front), Tampa-2 (deep middle from the Mike), Cover-3 match (modern
 * pattern-match), Cover-2 press (corners on the line), Cover-6 quarters (split-field). Adding a new
 * scheme is additive — append a constant and ship its data file.
 */
public enum DefensiveSchemeId {
  COVER_2_PRESS,
  COVER_3_MATCH,
  COVER_6_QUARTERS,
  FANGIO_LIGHT_BOX,
  BUDDY_RYAN_46,
  TAMPA_2
}
