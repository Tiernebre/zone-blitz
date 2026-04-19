package app.zoneblitz.league.hiring;

/**
 * Derived per-tick stance a candidate takes on a team's ACTIVE offer. Orthogonal to {@link
 * OfferStatus}: stance describes how the candidate feels about an open offer; status describes
 * lifecycle (ACTIVE / ACCEPTED / REJECTED). An offer stops carrying a stance once its status
 * becomes terminal.
 */
public enum OfferStance {
  /** Offer submitted; candidate has not yet reviewed it (no tick has run since submission). */
  PENDING,
  /** Candidate reviewed the terms and wants them revised upward. */
  RENEGOTIATE,
  /** Candidate is happy with the terms and will accept if the team clicks Hire. */
  AGREED
}
