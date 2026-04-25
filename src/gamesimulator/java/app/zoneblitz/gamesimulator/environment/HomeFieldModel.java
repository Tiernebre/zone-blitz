package app.zoneblitz.gamesimulator.environment;

import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.penalty.PenaltyDraw;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.Optional;

/**
 * Applies the crowd-noise and venue-comfort effects of playing at home. Consulted once per
 * scrimmage snap, before the league-baseline {@link
 * app.zoneblitz.gamesimulator.penalty.PenaltyModel} is asked. If this model returns a pre-snap
 * foul, the engine enforces it and the league-baseline pre-snap draw is skipped for this snap — so
 * the HFA shift is additive in rate, not a multiplier on an existing flag.
 *
 * <p>Keeping the shift in its own seam lets the calibration harness swap implementations —
 * deterministic, neutral, or amplified — without touching the rest of the pipeline. The default
 * implementation is tuned to produce a modest (~2.5 pt) home-field scoring tilt league-wide at
 * {@link HomeFieldAdvantage#LEAGUE_AVERAGE}.
 */
public interface HomeFieldModel {

  /**
   * Draw a bonus pre-snap foul on the road offense attributable to crowd noise (false start / delay
   * of game / illegal formation). Called once per snap; implementations must return empty when the
   * offense is the home team — home offenses are immune to the shift by construction.
   *
   * @param offenseSide which side is on offense this snap
   * @param offense offensive personnel that would have taken the snap, used to pick a committer
   * @param homeFieldAdvantage the home team's stadium strength for this game
   * @param rng random source scoped to this snap
   * @return a pre-snap draw if a crowd-noise flag fires, otherwise empty
   */
  Optional<PenaltyDraw.PreSnap> drawRoadPreSnapPenalty(
      Side offenseSide,
      OffensivePersonnel offense,
      HomeFieldAdvantage homeFieldAdvantage,
      RandomSource rng);

  /** Neutral implementation — never draws a crowd-noise penalty. */
  static HomeFieldModel neutral() {
    return (offenseSide, offense, hfa, rng) -> Optional.empty();
  }
}
