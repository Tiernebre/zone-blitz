package app.zoneblitz.gamesimulator.resolver.run;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.resolver.RunOutcome;
import app.zoneblitz.gamesimulator.rng.RandomSource;

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
   * @param offense 11 offensive players on the field (carrier, blockers)
   * @param defense 11 defensive players on the field (run-fit defenders, tacklers)
   * @param rng randomness source
   * @return the resolved {@link RunOutcome}
   */
  RunOutcome resolve(
      PlayCaller.PlayCall call,
      GameState state,
      OffensivePersonnel offense,
      DefensivePersonnel defense,
      RandomSource rng);
}
