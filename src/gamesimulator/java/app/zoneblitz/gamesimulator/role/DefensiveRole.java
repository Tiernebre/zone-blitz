package app.zoneblitz.gamesimulator.role;

import app.zoneblitz.gamesimulator.roster.Position;

/**
 * Defensive per-snap roles. Granularity is depth-(A) of the scheme/role/play-family scope: enough
 * to express box-vs-range safety, slot-vs-outside corner, nose-vs-3-tech-vs-5-tech interior, and
 * the 3-4 stand-up edge / 4-3 hand-down edge distinction. {@code DIME_LB} is the safety-bodied
 * extra defender common in big-nickel/dime fronts. Per-route-vs-coverage matchup (depth C) is
 * reachable on this enum later by extension.
 */
public enum DefensiveRole implements Role {
  NOSE(Position.DL),
  THREE_TECH(Position.DL),
  FIVE_TECH(Position.DL),
  EDGE(Position.DL),
  STAND_UP_OLB(Position.LB),
  MIKE_LB(Position.LB),
  WILL_LB(Position.LB),
  SAM_LB(Position.LB),
  OUTSIDE_CB(Position.CB),
  SLOT_CB(Position.CB),
  DEEP_S(Position.S),
  BOX_S(Position.S),
  DIME_LB(Position.S);

  private final Position basePosition;

  DefensiveRole(Position basePosition) {
    this.basePosition = basePosition;
  }

  @Override
  public String code() {
    return name();
  }

  @Override
  public Position basePosition() {
    return basePosition;
  }
}
