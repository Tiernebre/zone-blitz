package app.zoneblitz.gamesimulator.roster;

/**
 * Coarse football positions the sim needs to reason about. Finer distinctions (LT vs RT, MLB vs
 * WILL) can come later if a resolver actually differentiates them; today nothing does.
 */
public enum Position {
  QB,
  RB,
  FB,
  WR,
  TE,
  OL,
  DL,
  LB,
  CB,
  S,
  K,
  P,
  LS
}
