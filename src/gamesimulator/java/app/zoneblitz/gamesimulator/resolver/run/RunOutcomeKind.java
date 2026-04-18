package app.zoneblitz.gamesimulator.resolver.run;

/**
 * Mutually-exclusive sampling classifier for a rushing play. Four buckets chosen so the matchup
 * shift can tilt probability mass between tails:
 *
 * <ul>
 *   <li>{@link #STUFF} — carrier held to {@code yards <= 0}.
 *   <li>{@link #NORMAL} — gain of {@code 1..19}.
 *   <li>{@link #BREAKAWAY} — gain of {@code 20+}.
 *   <li>{@link #FUMBLE} — carrier fumbled (recovery resolved separately).
 * </ul>
 *
 * <p>Package-private: this enum drives which yardage sub-distribution the resolver samples and does
 * not leak to consumer-facing outcome records. A {@code RunOutcome.Run} with {@code yards = -2}
 * naturally reads as a stuff; downstream code does not branch on this classifier.
 */
enum RunOutcomeKind {
  STUFF,
  NORMAL,
  BREAKAWAY,
  FUMBLE
}
