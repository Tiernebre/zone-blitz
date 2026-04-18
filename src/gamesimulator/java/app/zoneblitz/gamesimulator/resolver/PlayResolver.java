package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Team;

/**
 * Top-level resolver contract. Dispatches the incoming play call to a family-specific resolver
 * (pass, run, …) and returns a {@link PlayOutcome} — the sealed root across every family.
 *
 * <p>Implementations are pure given their inputs; all randomness flows through the supplied {@link
 * RandomSource}.
 */
public interface PlayResolver {

  /**
   * Resolve the supplied play against the supplied teams and state.
   *
   * @param call the offensive play call
   * @param state current game state
   * @param offense offensive team
   * @param defense defensive team
   * @param rng randomness source
   * @return the resolved {@link PlayOutcome}
   */
  PlayOutcome resolve(
      PlayCaller.PlayCall call, GameState state, Team offense, Team defense, RandomSource rng);
}
