package app.zoneblitz.gamesimulator.scoring;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldGoalResult;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.UUID;

/**
 * Baseline distance-only field-goal resolver. Make probability is a piecewise-linear curve keyed on
 * kick distance:
 *
 * <ul>
 *   <li>&le; 20 yds → 99%
 *   <li>20–54 yds → linear fall from 99% to 50%
 *   <li>54–60 yds → linear fall from 50% to 0%
 * </ul>
 *
 * No block modeling — every miss is {@link FieldGoalResult#MISSED}. Distance is computed as {@code
 * (100 - yardLine) + 17} to account for the end zone and the 7-yard hold spot behind the line of
 * scrimmage. On a miss the defending team takes possession at the hold spot (LOS + 7 yds back from
 * the kicking team's frame).
 */
public final class DistanceCurveFieldGoalResolver implements FieldGoalResolver {

  private static final int HOLD_YARDS_BEHIND_LOS = 7;
  private static final int END_ZONE_DEPTH = 10;

  private final DistanceProbability makeProbability;

  public DistanceCurveFieldGoalResolver() {
    this(DistanceCurveFieldGoalResolver::baselineMakeProbability);
  }

  /** For tests that want to pin make/miss deterministically. */
  public DistanceCurveFieldGoalResolver(DistanceProbability makeProbability) {
    this.makeProbability = Objects.requireNonNull(makeProbability, "makeProbability");
  }

  /** Make-probability curve keyed on kick distance in yards. */
  @FunctionalInterface
  public interface DistanceProbability {
    double at(int distanceYards);
  }

  static double baselineMakeProbability(int distance) {
    if (distance <= 20) {
      return 0.99;
    }
    if (distance <= 54) {
      return 0.99 - (0.49 / 34.0) * (distance - 20);
    }
    if (distance <= 60) {
      return 0.50 - (0.50 / 6.0) * (distance - 54);
    }
    return 0.0;
  }

  @Override
  public Resolved resolve(
      Team kickingTeam,
      Side kickingSide,
      GameId gameId,
      int sequence,
      FieldPosition preSnapSpot,
      DownAndDistance preSnap,
      GameClock clock,
      Score scoreBeforeKick,
      RandomSource rng) {
    Objects.requireNonNull(kickingTeam, "kickingTeam");
    Objects.requireNonNull(kickingSide, "kickingSide");
    Objects.requireNonNull(gameId, "gameId");
    Objects.requireNonNull(preSnapSpot, "preSnapSpot");
    Objects.requireNonNull(preSnap, "preSnap");
    Objects.requireNonNull(clock, "clock");
    Objects.requireNonNull(scoreBeforeKick, "scoreBeforeKick");
    Objects.requireNonNull(rng, "rng");

    var distance = (100 - preSnapSpot.yardLine()) + END_ZONE_DEPTH + HOLD_YARDS_BEHIND_LOS;
    var p = makeProbability.at(distance);
    var made = rng.nextDouble() < p;
    var result = made ? FieldGoalResult.GOOD : FieldGoalResult.MISSED;
    var scoreAfter = made ? scoreBeforeKick.plus(kickingSide, 3) : scoreBeforeKick;

    var kicker = pickKicker(kickingTeam);
    var id = new PlayId(new UUID(gameId.value().getMostSignificantBits(), 0xFB00L | sequence));
    var event =
        new PlayEvent.FieldGoalAttempt(
            id,
            gameId,
            sequence,
            preSnap,
            preSnapSpot,
            clock,
            clock,
            scoreAfter,
            kicker,
            distance,
            result,
            Optional.empty());

    OptionalInt takeover =
        made
            ? OptionalInt.empty()
            : OptionalInt.of(Math.max(1, 100 - (preSnapSpot.yardLine() - HOLD_YARDS_BEHIND_LOS)));
    return new Resolved(event, scoreAfter, made, takeover);
  }

  private static PlayerId pickKicker(Team team) {
    return team.roster().stream()
        .filter(p -> p.position() == Position.K)
        .map(p -> p.id())
        .findFirst()
        .orElseGet(() -> team.roster().get(0).id());
  }
}
