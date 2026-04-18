package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Team;

/**
 * Resolves an offensive play call into a {@link PlayOutcome} — the intermediate resolution result
 * before penalty application, clock advancement, and {@link
 * app.zoneblitz.gamesimulator.event.PlayEvent} assembly.
 *
 * <p>Implementations must be pure given their inputs; all randomness flows through the supplied
 * {@link RandomSource}.
 *
 * <p>Target and defender selection are placeholder logic today (first-matching-position on the
 * roster); a dedicated target selector will replace it.
 */
public interface PlayResolver {

  /**
   * Resolve the supplied play against the supplied teams and state.
   *
   * @param call the offensive play call
   * @param state current game state
   * @param offense offensive team (source of the QB and receivers)
   * @param defense defensive team (source of coverage defenders / pass rushers)
   * @param rng randomness source
   * @return the resolved {@link PlayOutcome}
   */
  PlayOutcome resolve(
      PlayCaller.PlayCall call, GameState state, Team offense, Team defense, RandomSource rng);
}
