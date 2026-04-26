package app.zoneblitz.gamesimulator.playcalling;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.DefensiveCoachTendencies;
import app.zoneblitz.gamesimulator.roster.RosterProfile;

/**
 * Produces the defensive pre-snap call for a snap, given the situation, the visible offensive
 * formation, the DC's tendencies, and the defense's roster strengths. The selector sees only
 * information the real defense would (formation + situation), never the called play — that keeps
 * the seam honest when matchup-aware resolution (phase 5) wires {@link DefensiveCall} into outcome
 * shifts.
 *
 * <p>Implementations are pure given their inputs; all randomness flows through the supplied {@link
 * RandomSource}. Tendency shifts are additive nudges against league-average bands — situational
 * priors (3rd-and-long ⇒ more blitz, goal-line ⇒ more base) always dominate.
 */
public interface DefensiveCallSelector {

  /**
   * Select the defensive call for the coming snap.
   *
   * @param state current game state (down/distance, score, quarter, spot)
   * @param offenseFormation the offense's shown formation — visible pre-snap
   * @param dc defensive coordinator tendencies
   * @param defenseProfile aggregate attribute strengths of the defense's full roster; tendency-
   *     driven selectors consult {@link RosterProfile#pressureLean()} to nudge blitz frequency
   * @param rng randomness source
   * @return the resolved {@link DefensiveCall}
   */
  DefensiveCall select(
      GameState state,
      OffensiveFormation offenseFormation,
      DefensiveCoachTendencies dc,
      RosterProfile defenseProfile,
      RandomSource rng);

  /**
   * No-op selector that always returns {@link DefensiveCall#neutral()}. Useful for tests and any
   * consumer that needs the selector wired but not yet driving outcomes.
   */
  static DefensiveCallSelector neutral() {
    return (state, offenseFormation, dc, defenseProfile, rng) -> DefensiveCall.neutral();
  }
}
