package app.zoneblitz.gamesimulator.resolver.run;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.resolver.RunOutcome;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Team;

/**
 * Resolves a run-shaped play call into a {@link RunOutcome}. Pure given its inputs; all randomness
 * flows through the supplied {@link RandomSource}.
 */
public interface RunResolver {

  /**
   * Resolve the supplied run play.
   *
   * @param call the offensive play call
   * @param state current game state
   * @param offense offensive team (source of the ball carrier and blockers)
   * @param defense defensive team (source of run-fit defenders and tacklers)
   * @param rng randomness source
   * @return the resolved {@link RunOutcome}
   */
  RunOutcome resolve(
      PlayCaller.PlayCall call, GameState state, Team offense, Team defense, RandomSource rng);
}
