package app.zoneblitz.gamesimulator;

/**
 * Reference table of EV-optimal 4th-down go-for-it probabilities keyed by field position and
 * yards-to-gain. Blended against the tendency-driven go rate inside {@link
 * AggressionFourthDownPolicy} by a coach's {@link
 * app.zoneblitz.gamesimulator.roster.CoachQuality#decisionQuality()} — low-quality coaches follow
 * style, high-quality coaches follow the chart.
 *
 * <p>The seam exists so the tendency and EV references can evolve independently (for example,
 * swapping in a {@code nfl4th}-derived table without touching the policy).
 */
interface FourthDownEvTable {

  /**
   * Probability in {@code [0, 1]} that an EV-optimal coach would go for it on 4th down at this
   * spot. {@code yardLine} is yards from the defensive end zone (1 = backed up at own 1, 99 = 1
   * yard from scoring); {@code distance} is yards-to-gain.
   */
  double evOptimalGoProbability(int yardLine, int distance);
}
