package app.zoneblitz.gamesimulator.resolver.pass;

/**
 * Engine-internal sampling classifier for pass plays. Categories map to the keys of {@code
 * bands.outcome_mix} in {@code passing-plays.json} (case-insensitive).
 *
 * <p>Package-private on purpose: consumers see only {@link
 * app.zoneblitz.gamesimulator.resolver.PassOutcome} variants. The classifier is a sampling seam and
 * never escapes this package.
 */
enum PassOutcomeKind {
  COMPLETE,
  INCOMPLETE,
  INTERCEPTION,
  SACK,
  SCRAMBLE
}
