package app.zoneblitz.gamesimulator.personnel;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.roster.Team;

/**
 * Picks the 11 offensive and 11 defensive players on the field for a single snap, together with the
 * {@link OffensivePackage} / {@link DefensivePackage} that describes their grouping. Pure given its
 * inputs — no RNG, no state mutation.
 *
 * <p>Concrete implementations decide how personnel tracks the offensive call: base schemes, nickel
 * on obvious pass downs, goal-line on short-yardage at the 1, etc. The resolver layer never does
 * this selection itself — resolvers receive {@link OffensivePersonnel} / {@link DefensivePersonnel}
 * fully formed.
 */
public interface PersonnelSelector {

  /**
   * Select the offensive personnel package and its 11 players for the supplied call.
   *
   * @param call the offensive play call
   * @param state current game state
   * @param offense offensive team (full active roster)
   * @return the 11 offensive players plus their package
   */
  OffensivePersonnel selectOffense(PlayCaller.PlayCall call, GameState state, Team offense);

  /**
   * Select the defensive personnel package and its 11 players in response to the supplied offensive
   * personnel.
   *
   * @param call the offensive play call
   * @param offense the offensive personnel already selected for this snap
   * @param state current game state
   * @param defense defensive team (full active roster)
   * @return the 11 defensive players plus their package
   */
  DefensivePersonnel selectDefense(
      PlayCaller.PlayCall call, OffensivePersonnel offense, GameState state, Team defense);
}
