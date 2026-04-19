package app.zoneblitz.league.staff;

/**
 * Coaching/scouting specialty — the position a candidate understands best. Broader than the sim
 * roster {@code Position} enum: adds {@code EDGE} because coaching orgs carry a distinct EDGE / OLB
 * coach seat.
 */
public enum SpecialtyPosition {
  QB,
  RB,
  FB,
  WR,
  TE,
  OL,
  DL,
  EDGE,
  LB,
  CB,
  S,
  K,
  P,
  LS
}
