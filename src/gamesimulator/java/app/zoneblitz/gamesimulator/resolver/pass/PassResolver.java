package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Team;

/**
 * Resolves a pass-shaped play call into a {@link PassOutcome}. Pure given its inputs; all
 * randomness flows through the supplied {@link RandomSource}.
 */
public interface PassResolver {

  /**
   * Resolve the supplied pass play.
   *
   * @param call the offensive play call
   * @param state current game state
   * @param offense offensive team (source of the QB and receivers)
   * @param defense defensive team (source of coverage defenders / pass rushers)
   * @param rng randomness source
   * @return the resolved {@link PassOutcome}
   */
  PassOutcome resolve(
      PlayCaller.PlayCall call, GameState state, Team offense, Team defense, RandomSource rng);
}
