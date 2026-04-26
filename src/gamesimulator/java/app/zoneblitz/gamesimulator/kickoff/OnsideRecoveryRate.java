package app.zoneblitz.gamesimulator.kickoff;

import app.zoneblitz.gamesimulator.roster.Team;

/**
 * Per-attempt probability that the kicking team recovers an onside kick. Pure function of the two
 * teams' personnel — no clock, score, or RNG. {@link OnsideAwareKickoffResolver} consumes this
 * rate, draws the recovery coin, and selects the recoverer via {@link KickoffPlayerSelection}.
 *
 * <p>The seam exists so the league-wide ~10% baseline can be shifted by hands-team / kicker
 * attributes without bloating the resolver. Implementations must return a value in {@code [0, 1]}.
 */
public interface OnsideRecoveryRate {

  /** Probability in {@code [0, 1]} that the kicking team recovers. */
  double compute(Team kicking, Team receiving);
}
