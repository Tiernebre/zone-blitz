package app.zoneblitz.gamesimulator.kickoff;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.KickoffResult;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Kickoff resolver that layers onside-kick decision + resolution on top of a delegate normal-kick
 * resolver.
 *
 * <p>On every kickoff the {@link OnsideKickPolicy} is consulted. If it declines, the call is
 * forwarded verbatim to the delegate (typically {@link TouchbackKickoffResolver}). If it accepts,
 * an onside kick is sampled here:
 *
 * <ul>
 *   <li><b>Success probability</b> is sourced from the injected {@link OnsideRecoveryRate}.
 *       Defaults to a fixed 10% — matching the post-2018 NFL baseline (nflfastR 2018-2023 regular
 *       season: 29/321 declared onside kicks recovered, 9.0%) — but production wiring layers an
 *       attribute-aware decorator on top so kicker placement and hands-team ball-skills shift the
 *       rate.
 *   <li><b>Success:</b> the kicking team retains possession at its own {@code KICK_YARDLINE +
 *       ONSIDE_TRAVEL} (~45), the minimum legal travel distance of an onside kick.
 *   <li><b>Failure:</b> the receiving team takes over at that same spot, which (from their frame)
 *       is deep in opponent territory just past midfield.
 * </ul>
 */
public final class OnsideAwareKickoffResolver implements KickoffResolver {

  /** Kicks are taken from the kicking team's 35 yard line. */
  private static final int KICK_YARDLINE = 35;

  /** Minimum legal travel for an onside kick to be recoverable. */
  private static final int ONSIDE_TRAVEL = 10;

  private final KickoffResolver delegate;
  private final OnsideKickPolicy policy;
  private final OnsideRecoveryRate recoveryRate;

  public OnsideAwareKickoffResolver(KickoffResolver delegate, OnsideKickPolicy policy) {
    this(delegate, policy, new FixedOnsideRecoveryRate());
  }

  public OnsideAwareKickoffResolver(
      KickoffResolver delegate, OnsideKickPolicy policy, OnsideRecoveryRate recoveryRate) {
    this.delegate = Objects.requireNonNull(delegate, "delegate");
    this.policy = Objects.requireNonNull(policy, "policy");
    this.recoveryRate = Objects.requireNonNull(recoveryRate, "recoveryRate");
  }

  /** Construct with the default score-and-time-driven policy wrapping {@code delegate}. */
  public static OnsideAwareKickoffResolver withDefaultPolicy(KickoffResolver delegate) {
    return new OnsideAwareKickoffResolver(delegate, new ScoreAndTimeOnsideKickPolicy());
  }

  /**
   * Construct with the default score-and-time-driven policy and a custom recovery-rate model
   * wrapping {@code delegate}.
   */
  public static OnsideAwareKickoffResolver withDefaultPolicy(
      KickoffResolver delegate, OnsideRecoveryRate recoveryRate) {
    return new OnsideAwareKickoffResolver(
        delegate, new ScoreAndTimeOnsideKickPolicy(), recoveryRate);
  }

  @Override
  public Resolved resolve(
      Team kickingTeam,
      Team receivingTeam,
      Side receivingSide,
      GameId gameId,
      int sequence,
      GameClock clock,
      Score scoreAfter,
      RandomSource rng) {
    Objects.requireNonNull(kickingTeam, "kickingTeam");
    Objects.requireNonNull(receivingTeam, "receivingTeam");
    Objects.requireNonNull(receivingSide, "receivingSide");
    Objects.requireNonNull(gameId, "gameId");
    Objects.requireNonNull(clock, "clock");
    Objects.requireNonNull(scoreAfter, "scoreAfter");
    Objects.requireNonNull(rng, "rng");

    if (!policy.shouldAttemptOnside(receivingSide, scoreAfter, clock)) {
      return delegate.resolve(
          kickingTeam, receivingTeam, receivingSide, gameId, sequence, clock, scoreAfter, rng);
    }
    return resolveOnside(
        kickingTeam, receivingTeam, receivingSide, gameId, sequence, clock, scoreAfter, rng);
  }

  private Resolved resolveOnside(
      Team kickingTeam,
      Team receivingTeam,
      Side receivingSide,
      GameId gameId,
      int sequence,
      GameClock clock,
      Score scoreAfter,
      RandomSource rng) {
    var kicker = KickoffPlayerSelection.pickAccuracyKicker(kickingTeam);
    var kickingRecovers = rng.nextDouble() < recoveryRate.compute(kickingTeam, receivingTeam);
    var recoveringSpotKickingFrame = KICK_YARDLINE + ONSIDE_TRAVEL;
    var kickingSide = receivingSide == Side.HOME ? Side.AWAY : Side.HOME;

    KickoffResult result;
    Optional<PlayerId> returner;
    Side nextPossession;
    int nextSpotYardLine;

    if (kickingRecovers) {
      result = KickoffResult.ONSIDE_RECOVERED_BY_KICKING;
      returner = Optional.of(KickoffPlayerSelection.pickOnsideRecoverer(kickingTeam));
      nextPossession = kickingSide;
      nextSpotYardLine = recoveringSpotKickingFrame;
    } else {
      result = KickoffResult.ONSIDE_RECOVERED_BY_RECEIVING;
      returner = Optional.of(KickoffPlayerSelection.pickOnsideRecoverer(receivingTeam));
      nextPossession = receivingSide;
      nextSpotYardLine = 100 - recoveringSpotKickingFrame;
    }

    var id = new PlayId(new UUID(gameId.value().getMostSignificantBits(), 0xFE00L | sequence));
    var event =
        new PlayEvent.Kickoff(
            id,
            gameId,
            sequence,
            new DownAndDistance(1, 10),
            new FieldPosition(KICK_YARDLINE),
            clock,
            clock,
            scoreAfter,
            kicker,
            result,
            returner,
            ONSIDE_TRAVEL,
            true);
    return new Resolved(event, nextPossession, nextSpotYardLine);
  }
}
