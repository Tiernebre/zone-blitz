package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.rng.RandomSource;

/**
 * Top-level resolver contract. Dispatches the incoming play call to a family-specific resolver
 * (pass, run, …) and returns a {@link PlayOutcome} — the sealed root across every family.
 *
 * <p>Resolvers receive the 11 players on each side already assembled by a personnel selector;
 * picking who is on the field is not a resolver concern. Implementations are pure given their
 * inputs; all randomness flows through the supplied {@link RandomSource}.
 */
public interface PlayResolver {

  /**
   * Resolve the supplied play against the supplied on-field personnel and state.
   *
   * @param call the offensive play call
   * @param state current game state
   * @param offense 11 offensive players on the field plus their grouping
   * @param defense 11 defensive players on the field plus their grouping
   * @param rng randomness source
   * @return the resolved {@link PlayOutcome}
   */
  PlayOutcome resolve(
      PlayCaller.PlayCall call,
      GameState state,
      OffensivePersonnel offense,
      DefensivePersonnel defense,
      RandomSource rng);
}
