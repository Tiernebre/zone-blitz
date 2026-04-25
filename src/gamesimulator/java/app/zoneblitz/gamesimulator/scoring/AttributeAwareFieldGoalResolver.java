package app.zoneblitz.gamesimulator.scoring;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldGoalResult;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Skill;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.function.ToDoubleFunction;

/**
 * Kicker-attribute-aware {@link FieldGoalResolver} decorator. After the delegate resolves the
 * attempt, the kicker's centered skill score (mostly {@link Skill#kickAccuracy}, blending in {@link
 * Skill#kickPower} as distance grows) drives a probabilistic flip:
 *
 * <ul>
 *   <li>An above-average kicker who the delegate flagged as missing rolls a flip-to-make weighted
 *       by their score and the distance envelope.
 *   <li>A below-average kicker who the delegate flagged as making rolls a flip-to-miss the same
 *       way.
 * </ul>
 *
 * <p>The shift envelope is zero at chip-shot range (≤ 25 yds) and scales linearly up to {@link
 * #MAX_SHIFT} at long range. Short kicks barely move (the baseline is already ~99%), long kicks
 * spread elite vs. weak kickers by ~15 percentage points. Compose this above {@link
 * EnvironmentalFieldGoalResolver} so weather can still convert a kicker-aided make into a miss.
 */
public final class AttributeAwareFieldGoalResolver implements FieldGoalResolver {

  /** Maximum absolute make-rate shift at the long-range tail of the envelope. */
  static final double MAX_SHIFT = 0.15;

  /** Distance below which kicker attributes contribute zero shift (chip-shot floor). */
  static final int SHORT_FLOOR = 25;

  /** Distance at which the envelope reaches {@link #MAX_SHIFT}. */
  static final int LONG_TAIL = 60;

  private static final int HOLD_YARDS_BEHIND_LOS = 7;

  /**
   * Default weights — physical lean on power/explosiveness for leg drive (sum 100) and skill
   * aggregate blends accuracy with a small power tilt. Make rate is overwhelmingly accuracy-driven
   * but power matters at the cliff.
   */
  private static final ToDoubleFunction<Skill> SKILL_AGGREGATE =
      s -> 0.75 * s.kickAccuracy() + 0.25 * s.kickPower();

  private static final KickAttributeWeights DEFAULT_WEIGHTS =
      new KickAttributeWeights(0, 0, 0, 10, 60, 0, 0, 30, SKILL_AGGREGATE);

  private final FieldGoalResolver delegate;
  private final KickAttributeWeights weights;

  public AttributeAwareFieldGoalResolver(FieldGoalResolver delegate) {
    this(delegate, DEFAULT_WEIGHTS);
  }

  AttributeAwareFieldGoalResolver(FieldGoalResolver delegate, KickAttributeWeights weights) {
    this.delegate = Objects.requireNonNull(delegate, "delegate");
    this.weights = Objects.requireNonNull(weights, "weights");
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
    var base =
        delegate.resolve(
            kickingTeam,
            kickingSide,
            gameId,
            sequence,
            preSnapSpot,
            preSnap,
            clock,
            scoreBeforeKick,
            rng);

    var kicker = lookupKicker(kickingTeam, base.event().kicker());
    var score = weights.skillScore(kicker);
    var envelope = shiftEnvelope(base.event().distance());
    var shift = score * envelope;

    if (shift > 0 && !base.made()) {
      if (rng.nextDouble() < shift) {
        return flipToMake(base, kickingSide, scoreBeforeKick);
      }
    } else if (shift < 0 && base.made()) {
      if (rng.nextDouble() < -shift) {
        return flipToMiss(base, preSnapSpot, scoreBeforeKick);
      }
    }
    return base;
  }

  static double shiftEnvelope(int distance) {
    if (distance <= SHORT_FLOOR) {
      return 0.0;
    }
    if (distance >= LONG_TAIL) {
      return MAX_SHIFT;
    }
    return MAX_SHIFT * (distance - SHORT_FLOOR) / (double) (LONG_TAIL - SHORT_FLOOR);
  }

  private static Resolved flipToMake(Resolved base, Side kickingSide, Score scoreBeforeKick) {
    var original = base.event();
    var scoreAfter = scoreBeforeKick.plus(kickingSide, 3);
    var made =
        new PlayEvent.FieldGoalAttempt(
            original.id(),
            original.gameId(),
            original.sequence(),
            original.preSnap(),
            original.preSnapSpot(),
            original.clockBefore(),
            original.clockAfter(),
            scoreAfter,
            original.kicker(),
            original.distance(),
            FieldGoalResult.GOOD,
            Optional.empty());
    return new Resolved(made, scoreAfter, true, OptionalInt.empty());
  }

  private static Resolved flipToMiss(
      Resolved base, FieldPosition preSnapSpot, Score scoreBeforeKick) {
    var original = base.event();
    var missed =
        new PlayEvent.FieldGoalAttempt(
            original.id(),
            original.gameId(),
            original.sequence(),
            original.preSnap(),
            original.preSnapSpot(),
            original.clockBefore(),
            original.clockAfter(),
            scoreBeforeKick,
            original.kicker(),
            original.distance(),
            FieldGoalResult.MISSED,
            Optional.empty());
    var takeover =
        OptionalInt.of(Math.max(1, 100 - (preSnapSpot.yardLine() - HOLD_YARDS_BEHIND_LOS)));
    return new Resolved(missed, scoreBeforeKick, false, takeover);
  }

  private static Player lookupKicker(Team team, PlayerId kickerId) {
    return team.roster().stream()
        .filter(p -> p.id().equals(kickerId))
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("kicker not on roster: " + kickerId));
  }
}
