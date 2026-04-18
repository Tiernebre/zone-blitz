package app.zoneblitz.gamesimulator.scoring;

import app.zoneblitz.gamesimulator.EnvironmentalModifiers;
import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldGoalResult;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalInt;

/**
 * Weather-aware {@link FieldGoalResolver} decorator. Re-runs the delegate and then applies a
 * post-hoc correction when environmental conditions would flip a made kick to a miss:
 *
 * <ul>
 *   <li>Wind shaves accuracy by {@link EnvironmentalModifiers#kickAccuracyPenalty()} — a 30 mph
 *       wind drops every kick's make probability by ~36% (absolute).
 *   <li>Cold reduces effective range by {@link EnvironmentalModifiers#kickerRangeYardsLost()};
 *       kicks from beyond that distance miss regardless of the delegate's roll.
 * </ul>
 *
 * The decorator preserves the delegate's {@link PlayEvent.FieldGoalAttempt} wiring — only the
 * result flag, score, and takeover spot shift on a converted-to-miss.
 */
public final class EnvironmentalFieldGoalResolver implements FieldGoalResolver {

  private static final int HOLD_YARDS_BEHIND_LOS = 7;
  private static final int BASELINE_MAX_MAKEABLE_DISTANCE = 60;

  private final FieldGoalResolver delegate;
  private final EnvironmentalModifiers modifiers;

  public EnvironmentalFieldGoalResolver(
      FieldGoalResolver delegate, EnvironmentalModifiers modifiers) {
    this.delegate = Objects.requireNonNull(delegate, "delegate");
    this.modifiers = Objects.requireNonNull(modifiers, "modifiers");
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
    if (!base.made()) {
      return base;
    }

    var distance = base.event().distance();
    var coldCutoff = BASELINE_MAX_MAKEABLE_DISTANCE - modifiers.kickerRangeYardsLost();
    var windRoll = rng.nextDouble();
    var beyondColdRange = distance > coldCutoff;
    var windMiss = windRoll < modifiers.kickAccuracyPenalty();
    if (!beyondColdRange && !windMiss) {
      return base;
    }
    return flipToMiss(base, preSnapSpot, scoreBeforeKick);
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
}
