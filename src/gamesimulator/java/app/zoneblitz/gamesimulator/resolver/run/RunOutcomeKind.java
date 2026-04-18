package app.zoneblitz.gamesimulator.resolver.run;

/**
 * Mutually-exclusive shape classification for a rushing play's outcome.
 *
 * <p>Scope is deliberately narrow — stuffs and breakaways are not separate kinds; they fall out of
 * the yardage distribution's tails. Fumble-recovery is resolved downstream of the outcome mix, so
 * "fumble" here means the carrier fumbled on the play, not that the ball changed hands.
 */
public enum RunOutcomeKind {
  /** A standard rushing play resolved via the yardage distribution. */
  NORMAL,
  /** The carrier fumbled. Recovery team is resolved separately. */
  FUMBLE
}
