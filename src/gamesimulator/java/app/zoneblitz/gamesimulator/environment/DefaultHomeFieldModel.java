package app.zoneblitz.gamesimulator.environment;

import app.zoneblitz.gamesimulator.event.PenaltyType;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.penalty.PenaltyDraw;
import app.zoneblitz.gamesimulator.penalty.PenaltyEnforcement;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.List;
import java.util.Optional;

/**
 * Default {@link HomeFieldModel}. Adds a small crowd-noise pre-snap penalty rate on the road
 * offense, scaled linearly by the home stadium's {@link HomeFieldAdvantage#strength()}. A neutral
 * home field (strength 0) produces no shift; league-average (strength 50) produces the {@link
 * #LEAGUE_AVERAGE_BONUS_RATE} per-snap bonus rate; strength 100 doubles that.
 *
 * <p>The flag-type mix (false start, delay of game, illegal formation) mirrors the NFL's road-team
 * pre-snap distribution — false start dominates, because that is the flag most directly
 * attributable to crowd noise.
 */
public final class DefaultHomeFieldModel implements HomeFieldModel {

  /**
   * Per-snap bonus pre-snap penalty rate on the road offense at league-average stadium strength.
   * Sized so that across ~60 road offensive snaps per game the road team takes roughly one extra
   * crowd-noise flag, which together with the resulting loss of down tempo produces the historical
   * ~2.5-point home-field scoring tilt.
   */
  static final double LEAGUE_AVERAGE_BONUS_RATE = 0.035;

  private static final List<TypeShare> TYPE_DISTRIBUTION =
      List.of(
          new TypeShare(PenaltyType.FALSE_START, 0.70, 5),
          new TypeShare(PenaltyType.DELAY_OF_GAME, 0.20, 5),
          new TypeShare(PenaltyType.ILLEGAL_FORMATION, 0.10, 5));

  @Override
  public Optional<PenaltyDraw.PreSnap> drawRoadPreSnapPenalty(
      Side offenseSide,
      OffensivePersonnel offense,
      HomeFieldAdvantage homeFieldAdvantage,
      RandomSource rng) {
    if (offenseSide == Side.HOME) {
      return Optional.empty();
    }
    if (homeFieldAdvantage.strength() <= 0) {
      return Optional.empty();
    }
    var bonusRate =
        LEAGUE_AVERAGE_BONUS_RATE
            * (homeFieldAdvantage.strength() / (double) HomeFieldAdvantage.LEAGUE_AVERAGE);
    if (rng.nextDouble() >= bonusRate) {
      return Optional.empty();
    }

    var typeRoll = rng.nextDouble();
    var acc = 0.0;
    var picked = TYPE_DISTRIBUTION.get(TYPE_DISTRIBUTION.size() - 1);
    for (var share : TYPE_DISTRIBUTION) {
      acc += share.share();
      if (typeRoll < acc) {
        picked = share;
        break;
      }
    }

    var offensePlayers = offense.players();
    var committedBy = offensePlayers.get((int) (rng.nextDouble() * offensePlayers.size())).id();
    return Optional.of(
        new PenaltyDraw.PreSnap(
            picked.type(), offenseSide, committedBy, picked.yards(), PenaltyEnforcement.preSnap()));
  }

  private record TypeShare(PenaltyType type, double share, int yards) {}
}
