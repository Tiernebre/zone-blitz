package app.zoneblitz.gamesimulator.punt;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayId;
import app.zoneblitz.gamesimulator.event.PuntResult;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Long-snapper-aware {@link PuntResolver} decorator. Before the delegate resolves the punt, the
 * kicking team's long-snapper {@link app.zoneblitz.gamesimulator.roster.Skill#snapAccuracy() snap
 * accuracy} drives a small probability of a botched snap. A botched snap forces a {@link
 * PuntResult#BLOCKED} outcome (the punt never gets off cleanly), giving the receiving team the ball
 * behind the line of scrimmage.
 *
 * <p>Bad-snap probability scales linearly with how far below average the LS sits:
 *
 * <ul>
 *   <li>snapAccuracy 50 (average) → 0% added bad-snap rate.
 *   <li>snapAccuracy 0 → {@link #MAX_BAD_SNAP_RATE} ({@value #MAX_BAD_SNAP_RATE}).
 *   <li>snapAccuracy &gt; 50 → 0% (elite LSs do not lower the baseline below the delegate's draw).
 * </ul>
 *
 * <p>If no long-snapper is on the kicking roster the decorator is a no-op pass-through. Compose
 * below {@link AttributeAwarePuntResolver} so a botched snap is final and not overridden by leg
 * attributes.
 */
public final class LongSnapperAwarePuntResolver implements PuntResolver {

  /** Maximum added bad-snap probability at floor (snapAccuracy = 0). */
  static final double MAX_BAD_SNAP_RATE = 0.04;

  /** Yards behind LOS where the receiving team recovers a botched snap. */
  static final int BLOCK_RECOVERY_BEHIND_LOS = 5;

  private final PuntResolver delegate;

  public LongSnapperAwarePuntResolver(PuntResolver delegate) {
    this.delegate = Objects.requireNonNull(delegate, "delegate");
  }

  @Override
  public Resolved resolve(
      Team kickingTeam,
      Team receivingTeam,
      Side kickingSide,
      GameId gameId,
      int sequence,
      FieldPosition preSnapSpot,
      DownAndDistance preSnap,
      GameClock clock,
      Score scoreAfter,
      RandomSource rng) {
    var ls = lookupLongSnapper(kickingTeam);
    if (ls.isPresent()) {
      var rate = badSnapRate(ls.get().skill().snapAccuracy());
      if (rate > 0.0 && rng.nextDouble() < rate) {
        return botchedSnap(
            kickingTeam, kickingSide, gameId, sequence, preSnapSpot, preSnap, clock, scoreAfter);
      }
    }
    return delegate.resolve(
        kickingTeam,
        receivingTeam,
        kickingSide,
        gameId,
        sequence,
        preSnapSpot,
        preSnap,
        clock,
        scoreAfter,
        rng);
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

  private static Resolved botchedSnap(
      Team kickingTeam,
      Side kickingSide,
      GameId gameId,
      int sequence,
      FieldPosition preSnapSpot,
      DownAndDistance preSnap,
      GameClock clock,
      Score scoreAfter) {
    var receivingSide = kickingSide == Side.HOME ? Side.AWAY : Side.HOME;
    var losYardLine = preSnapSpot.yardLine();
    var recoverYardLine = Math.max(1, losYardLine - BLOCK_RECOVERY_BEHIND_LOS);
    var nextSpotYardLine = Math.min(99, 100 - recoverYardLine);
    var punterId =
        kickingTeam.roster().stream()
            .filter(p -> p.position() == Position.P)
            .findFirst()
            .or(
                () ->
                    kickingTeam.roster().stream()
                        .filter(p -> p.position() == Position.K)
                        .findFirst())
            .map(Player::id)
            .orElseGet(() -> kickingTeam.roster().get(0).id());
    var id = new PlayId(new UUID(gameId.value().getMostSignificantBits(), 0xFC10L | sequence));
    var event =
        new PlayEvent.Punt(
            id,
            gameId,
            sequence,
            preSnap,
            preSnapSpot,
            clock,
            clock,
            scoreAfter,
            punterId,
            0,
            Optional.empty(),
            0,
            PuntResult.BLOCKED);
    return new Resolved(event, receivingSide, nextSpotYardLine);
  }
}
