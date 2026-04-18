package app.zoneblitz.gamesimulator.resolver.pass;

/**
 * What the quarterback does when the pass rush wins the protection matchup. Engine-internal
 * classifier — never leaks onto the {@link app.zoneblitz.gamesimulator.resolver.PassOutcome} API.
 *
 * <p>{@link #SACK} is the nominal outcome: protection broke down and the QB went down. {@link
 * #SCRAMBLE} represents a mobile QB escaping the pocket for yardage. {@link #THROWAWAY} represents
 * an aware QB getting rid of the ball before the sack lands (scored as an incomplete pass).
 */
enum PressureResolution {
  SACK,
  SCRAMBLE,
  THROWAWAY
}
