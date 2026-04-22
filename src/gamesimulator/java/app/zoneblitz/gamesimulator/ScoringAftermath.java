package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import java.util.List;
import java.util.Objects;

/**
 * Resolves the post-snap consequences of a terminal play — touchdown (offensive or defensive),
 * safety, or turnover (interception/fumble/on-downs). Each branch updates score + clock, checks for
 * overtime conclusion, and then dispatches the follow-up sequence (PAT + kickoff, free-kick, or
 * possession flip) through {@link ScoringSequencer} / {@link PeriodController}.
 *
 * <p>Returns the state the snap loop should continue with. When the returned state's phase is
 * {@link GameState.Phase#FINAL}, the caller should stop looping immediately.
 */
final class ScoringAftermath {

  private static final long TD_KICKOFF_KEY = 0x5C01DL;
  private static final long DEF_TD_KICKOFF_KEY = 0x5C02DL;
  private static final long SAFETY_KICKOFF_KEY = 0x5C04DL;

  /** Conceding team free-kicks from their own 20 after a safety. */
  private static final int SAFETY_FREE_KICK_SPOT = 20;

  private final ScoringSequencer scoring;

  ScoringAftermath(ScoringSequencer scoring) {
    this.scoring = Objects.requireNonNull(scoring, "scoring");
  }

  GameState afterTouchdown(
      List<PlayEvent> out,
      GameState state,
      GameInputs inputs,
      Context ctx,
      long sequence,
      int[] seq,
      SplittableRandomSource root,
      long gameKey) {
    state = state.withScore(ctx.scoreAfter).withClock(ctx.clockAfter);
    state = PeriodController.concludeOvertimePossession(state, ctx.offenseSide);
    if (state.phase() == GameState.Phase.FINAL) {
      return state;
    }
    state = scoring.emitPat(out, state, inputs, ctx.offenseSide, seq, root, gameKey ^ sequence);
    return scoring.emitKickoff(
        out, state, inputs, ctx.defenseSide, seq, root.split(gameKey ^ sequence ^ TD_KICKOFF_KEY));
  }

  GameState afterDefensiveTouchdown(
      List<PlayEvent> out,
      GameState state,
      GameInputs inputs,
      Context ctx,
      long sequence,
      int[] seq,
      SplittableRandomSource root,
      long gameKey) {
    state = state.withScore(ctx.scoreAfter).withClock(ctx.clockAfter);
    state = PeriodController.concludeOvertimePossession(state, ctx.offenseSide);
    if (state.phase() == GameState.Phase.FINAL) {
      return state;
    }
    state = scoring.emitPat(out, state, inputs, ctx.defenseSide, seq, root, gameKey ^ sequence);
    return scoring.emitKickoff(
        out,
        state,
        inputs,
        ctx.offenseSide,
        seq,
        root.split(gameKey ^ sequence ^ DEF_TD_KICKOFF_KEY));
  }

  GameState afterSafety(
      List<PlayEvent> out,
      GameState state,
      GameInputs inputs,
      Context ctx,
      long sequence,
      int[] seq,
      SplittableRandomSource root,
      long gameKey) {
    state = state.withScore(ctx.scoreAfter).withClock(ctx.clockAfter);
    var freeKickSpot = new FieldPosition(SAFETY_FREE_KICK_SPOT);
    out.add(
        PlayEventFactory.safetyEvent(
            state, inputs.gameId(), seq[0]++, freeKickSpot, ctx.offenseSide));
    state = PeriodController.concludeOvertimePossession(state, ctx.offenseSide);
    if (state.phase() == GameState.Phase.FINAL) {
      return state;
    }
    return scoring.emitKickoff(
        out,
        state,
        inputs,
        ctx.defenseSide,
        seq,
        root.split(gameKey ^ sequence ^ SAFETY_KICKOFF_KEY));
  }

  GameState afterLiveBallTurnover(GameState state, Context ctx, int endYardLine) {
    state = state.withScore(ctx.scoreAfter).withClock(ctx.clockAfter);
    state = PeriodController.concludeOvertimePossession(state, ctx.offenseSide);
    if (state.phase() == GameState.Phase.FINAL) {
      return state;
    }
    return state.withPossessionAndSpot(ctx.defenseSide, new FieldPosition(endYardLine));
  }

  GameState afterTurnoverOnDowns(GameState state, Context ctx, int endYardLine) {
    state = state.withClock(ctx.clockAfter);
    state = PeriodController.concludeOvertimePossession(state, ctx.offenseSide);
    if (state.phase() == GameState.Phase.FINAL) {
      return state;
    }
    return state.withPossessionAndSpot(ctx.defenseSide, new FieldPosition(100 - endYardLine));
  }

  /** Snapshot of the scoring / clock / side context at the moment of a terminal play. */
  record Context(Score scoreAfter, GameClock clockAfter, Side offenseSide, Side defenseSide) {}
}
