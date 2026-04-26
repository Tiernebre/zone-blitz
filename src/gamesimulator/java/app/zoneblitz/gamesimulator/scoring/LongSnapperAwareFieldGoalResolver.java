package app.zoneblitz.gamesimulator.scoring;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldGoalResult;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalInt;

/**
 * Long-snapper-aware {@link FieldGoalResolver} decorator. After the delegate produces an attempt,
 * the kicking team's long-snapper {@link app.zoneblitz.gamesimulator.roster.Skill#snapAccuracy()
 * snap accuracy} can flip a make to a miss when the snap is botched. Botched snaps never aid a
 * make.
 *
 * <p>Bad-snap probability scales with how far below average the LS sits (same envelope as the punt
 * decorator):
 *
 * <ul>
 *   <li>snapAccuracy ≥ 50 → 0% added botch rate.
 *   <li>snapAccuracy 0 → {@link #MAX_BAD_SNAP_RATE} ({@value #MAX_BAD_SNAP_RATE}).
 * </ul>
 *
 * <p>If no long-snapper is on the kicking roster the decorator is a no-op pass-through. Compose
 * above {@link AttributeAwareFieldGoalResolver} so the LS gate is the final word.
 */
public final class LongSnapperAwareFieldGoalResolver implements FieldGoalResolver {

  /** Maximum added botch rate at floor (snapAccuracy = 0). */
  static final double MAX_BAD_SNAP_RATE = 0.04;

  private static final int HOLD_YARDS_BEHIND_LOS = 7;

  private final FieldGoalResolver delegate;

  public LongSnapperAwareFieldGoalResolver(FieldGoalResolver delegate) {
    this.delegate = Objects.requireNonNull(delegate, "delegate");
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
    var ls = lookupLongSnapper(kickingTeam);
    if (ls.isEmpty()) {
      return base;
    }
    var rate = badSnapRate(ls.get().skill().snapAccuracy());
    if (rate <= 0.0 || rng.nextDouble() >= rate) {
      return base;
    }
    return flipToMiss(base, preSnapSpot, scoreBeforeKick);
  }

  static double badSnapRate(int snapAccuracy) {
    if (snapAccuracy >= 50) {
      return 0.0;
    }
    return MAX_BAD_SNAP_RATE * (50 - snapAccuracy) / 50.0;
  }

  private static Optional<Player> lookupLongSnapper(Team team) {
    return team.roster().stream().filter(p -> p.position() == Position.LS).findFirst();
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
