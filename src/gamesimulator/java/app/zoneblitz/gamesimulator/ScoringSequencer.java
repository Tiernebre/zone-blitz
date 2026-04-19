package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.clock.ClockModel;
import app.zoneblitz.gamesimulator.clock.Kick;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.kickoff.KickoffResolver;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.scoring.ExtraPointResolver;
import app.zoneblitz.gamesimulator.scoring.TwoPointDecisionPolicy;
import app.zoneblitz.gamesimulator.scoring.TwoPointResolver;
import java.util.List;
import java.util.Objects;

/**
 * Emits post-score sequences (PAT / 2-point / kickoff) and maintains the kick-clock tick used by
 * every kicking play. Groups resolvers that all post-score paths share so the main engine doesn't
 * see them directly.
 */
final class ScoringSequencer {

  private static final long PAT_SPLIT_KEY = 0xFA77_7777L;
  private static final long TWO_POINT_SPLIT_KEY = 0xFB77_7777L;

  private final ClockModel clockModel;
  private final KickoffResolver kickoffResolver;
  private final ExtraPointResolver extraPointResolver;
  private final TwoPointResolver twoPointResolver;
  private final TwoPointDecisionPolicy twoPointPolicy;

  ScoringSequencer(
      ClockModel clockModel,
      KickoffResolver kickoffResolver,
      ExtraPointResolver extraPointResolver,
      TwoPointResolver twoPointResolver,
      TwoPointDecisionPolicy twoPointPolicy) {
    this.clockModel = Objects.requireNonNull(clockModel, "clockModel");
    this.kickoffResolver = Objects.requireNonNull(kickoffResolver, "kickoffResolver");
    this.extraPointResolver = Objects.requireNonNull(extraPointResolver, "extraPointResolver");
    this.twoPointResolver = Objects.requireNonNull(twoPointResolver, "twoPointResolver");
    this.twoPointPolicy = Objects.requireNonNull(twoPointPolicy, "twoPointPolicy");
  }

  GameState emitPat(
      List<PlayEvent> out,
      GameState state,
      GameInputs inputs,
      Side scoringSide,
      int[] seq,
      SplittableRandomSource root,
      long key) {
    if (twoPointPolicy.goForTwo(state.score(), scoringSide, state.clock())) {
      return emitTwoPointAttempt(out, state, inputs, scoringSide, seq, root, key);
    }
    var sequence = seq[0]++;
    var kicking = scoringSide == Side.HOME ? inputs.home() : inputs.away();
    var rng = root.split(key ^ PAT_SPLIT_KEY ^ ((long) sequence << 32));
    var resolved =
        extraPointResolver.resolve(
            kicking, scoringSide, inputs.gameId(), sequence, state.clock(), state.score(), rng);
    out.add(resolved.event());
    return state
        .withScore(resolved.scoreAfter())
        .withClock(tickKickClock(state, Kick.EXTRA_POINT, rng));
  }

  GameState emitKickoff(
      List<PlayEvent> out,
      GameState state,
      GameInputs inputs,
      Side receivingSide,
      int[] seq,
      RandomSource rng) {
    var kickingSide = receivingSide == Side.HOME ? Side.AWAY : Side.HOME;
    var kicking = kickingSide == Side.HOME ? inputs.home() : inputs.away();
    var receiving = receivingSide == Side.HOME ? inputs.home() : inputs.away();
    var resolved =
        kickoffResolver.resolve(
            kicking,
            receiving,
            receivingSide,
            inputs.gameId(),
            seq[0]++,
            state.clock(),
            state.score(),
            rng);
    out.add(resolved.event());
    state = state.withClock(tickKickClock(state, Kick.KICKOFF, rng));
    return state.withPossessionAndSpot(
        resolved.nextPossession(), new FieldPosition(resolved.nextSpotYardLine()));
  }

  GameClock tickKickClock(GameState state, Kick kick, RandomSource rng) {
    var consumed = clockModel.secondsConsumedForKick(kick, state, rng);
    return new GameClock(state.clock().quarter(), state.clock().secondsRemaining() - consumed);
  }

  private GameState emitTwoPointAttempt(
      List<PlayEvent> out,
      GameState state,
      GameInputs inputs,
      Side scoringSide,
      int[] seq,
      SplittableRandomSource root,
      long key) {
    var sequence = seq[0]++;
    var scoring = scoringSide == Side.HOME ? inputs.home() : inputs.away();
    var rng = root.split(key ^ TWO_POINT_SPLIT_KEY ^ ((long) sequence << 32));
    var resolved =
        twoPointResolver.resolve(
            scoring, scoringSide, inputs.gameId(), sequence, state.clock(), state.score(), rng);
    out.add(resolved.event());
    return state.withScore(resolved.scoreAfter());
  }
}
