package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.clock.Kick;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.punt.PuntResolver;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.scoring.FieldGoalResolver;
import java.util.List;
import java.util.Objects;

/**
 * Resolves 4th-down kicking plays — field goals and punts — and delegates the resulting kickoff
 * sequence (on a made field goal) to {@link ScoringSequencer}.
 */
final class SpecialTeams {

  private static final long FG_SPLIT_KEY = 0xFB66_6666L;
  private static final long PUNT_SPLIT_KEY = 0xFC55_5555L;
  private static final long POST_FG_KICKOFF_KEY = 0x5C03DL;

  /**
   * Inside this many yards of the opposing goal line a 4th down triggers a field-goal attempt.
   * Value 63 corresponds to the opponent's 37-yard line, i.e. a kick of {@code (100 - 63) + 17 =
   * 54} yards — the baseline edge of reasonable make probability.
   */
  private static final int FIELD_GOAL_MIN_YARD_LINE = 63;

  /**
   * After a safety, the conceding team free-kicks from their own 20 and we model it as a direct
   * spot of the ball for the scoring team at their own 20. Simplification flagged as a follow-up.
   */
  private static final int FAILED_FG_FALLBACK_YARD_LINE = 20;

  private final ScoringSequencer scoring;

  SpecialTeams(ScoringSequencer scoring) {
    this.scoring = Objects.requireNonNull(scoring, "scoring");
  }

  static boolean shouldAttemptFieldGoal(GameState state) {
    return state.downAndDistance().down() == 4
        && state.spot().yardLine() >= FIELD_GOAL_MIN_YARD_LINE;
  }

  static boolean shouldPunt(GameState state) {
    return state.downAndDistance().down() == 4
        && state.spot().yardLine() < FIELD_GOAL_MIN_YARD_LINE;
  }

  GameState runFieldGoal(
      List<PlayEvent> out,
      GameState state,
      GameInputs inputs,
      int[] seq,
      SplittableRandomSource root,
      long gameKey,
      FieldGoalResolver fieldGoal) {
    var sequence = seq[0]++;
    var offenseSide = state.possession();
    var defenseSide = offenseSide == Side.HOME ? Side.AWAY : Side.HOME;
    var kicking = offenseSide == Side.HOME ? inputs.home() : inputs.away();
    var rng = root.split(gameKey ^ ((long) sequence << 32) ^ FG_SPLIT_KEY);
    var resolved =
        fieldGoal.resolve(
            kicking,
            offenseSide,
            inputs.gameId(),
            sequence,
            state.spot(),
            state.downAndDistance(),
            state.clock(),
            state.score(),
            rng);
    out.add(resolved.event());
    state =
        state
            .withScore(resolved.scoreAfter())
            .withClock(scoring.tickKickClock(state, Kick.FIELD_GOAL, rng));

    state = PeriodController.concludeOvertimePossession(state, offenseSide);
    if (state.phase() == GameState.Phase.FINAL) {
      return state;
    }
    if (resolved.made()) {
      return scoring.emitKickoff(
          out,
          state,
          inputs,
          defenseSide,
          seq,
          root.split(gameKey ^ sequence ^ POST_FG_KICKOFF_KEY));
    }
    var takeover = resolved.receivingTakeoverYardLine().orElse(FAILED_FG_FALLBACK_YARD_LINE);
    return state.withPossessionAndSpot(defenseSide, new FieldPosition(takeover));
  }

  GameState runPunt(
      List<PlayEvent> out,
      GameState state,
      GameInputs inputs,
      int[] seq,
      SplittableRandomSource root,
      long gameKey,
      PuntResolver punt) {
    var sequence = seq[0]++;
    var offenseSide = state.possession();
    var defenseSide = offenseSide == Side.HOME ? Side.AWAY : Side.HOME;
    var kicking = offenseSide == Side.HOME ? inputs.home() : inputs.away();
    var receiving = defenseSide == Side.HOME ? inputs.home() : inputs.away();
    var rng = root.split(gameKey ^ ((long) sequence << 32) ^ PUNT_SPLIT_KEY);
    var resolved =
        punt.resolve(
            kicking,
            receiving,
            offenseSide,
            inputs.gameId(),
            sequence,
            state.spot(),
            state.downAndDistance(),
            state.clock(),
            state.score(),
            rng);
    out.add(resolved.event());
    state = state.withClock(scoring.tickKickClock(state, Kick.PUNT, rng));
    state = PeriodController.concludeOvertimePossession(state, offenseSide);
    if (state.phase() == GameState.Phase.FINAL) {
      return state;
    }
    return state.withPossessionAndSpot(
        defenseSide, new FieldPosition(resolved.receivingTakeoverYardLine()));
  }
}
