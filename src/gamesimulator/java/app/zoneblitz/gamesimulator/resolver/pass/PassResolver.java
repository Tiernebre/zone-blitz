package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.rng.RandomSource;

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
   * @param offense 11 offensive players on the field (QB, receivers, blockers)
   * @param defense 11 defensive players on the field (rushers, coverage)
   * @param rng randomness source
   * @return the resolved {@link PassOutcome}
   */
  PassOutcome resolve(
      PlayCaller.PlayCall call,
      GameState state,
      OffensivePersonnel offense,
      DefensivePersonnel defense,
      RandomSource rng);
}
