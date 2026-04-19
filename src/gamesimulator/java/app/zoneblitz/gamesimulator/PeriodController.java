package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import java.util.List;
import java.util.Objects;

/**
 * Owns period boundaries: end-of-quarter transitions (including halftime kickoff), overtime start
 * and termination, and the modified-sudden-death bookkeeping in {@link
 * #concludeOvertimePossession}.
 */
final class PeriodController {

  private static final int REGULATION_QUARTER_SECONDS = 15 * 60;
  private static final int REGULAR_SEASON_OT_PERIOD_SECONDS = 10 * 60;
  private static final int PLAYOFF_OT_PERIOD_SECONDS = 15 * 60;
  private static final long OT_COIN_TOSS_KEY = 0xC0DE_CAFEL;
  private static final long HALFTIME_KICKOFF_KEY = 0xB00BL;
  private static final long OT_KICKOFF_KEY = 0xD1AABBL;

  private final ScoringSequencer scoring;

  PeriodController(ScoringSequencer scoring) {
    this.scoring = Objects.requireNonNull(scoring, "scoring");
  }

  GameState endOfQuarter(
      List<app.zoneblitz.gamesimulator.event.PlayEvent> out,
      GameState state,
      GameInputs inputs,
      Side openingReceiver,
      int[] seq,
      SplittableRandomSource root,
      long gameKey) {
    var quarter = state.clock().quarter();
    out.add(PlayEventFactory.endOfQuarterEvent(state, inputs.gameId(), seq[0]++, quarter));

    if (quarter == 4) {
      if (state.score().home() != state.score().away()) {
        return state.withPhase(GameState.Phase.FINAL);
      }
      return startOvertimePeriod(out, state, inputs, seq, root, gameKey, 1);
    }

    if (quarter >= 5) {
      return endOfOvertimePeriod(out, state, inputs, seq, root, gameKey);
    }

    var nextClock = new GameClock(quarter + 1, REGULATION_QUARTER_SECONDS);
    var advanced = state.withClock(nextClock);
    if (quarter == 2) {
      var secondHalfReceiver = openingReceiver == Side.HOME ? Side.AWAY : Side.HOME;
      var afterHalf = advanced.withTimeoutsReset().withFatigueRecovered(1.0);
      return scoring.emitKickoff(
          out,
          afterHalf,
          inputs,
          secondHalfReceiver,
          seq,
          root.split(gameKey ^ HALFTIME_KICKOFF_KEY));
    }
    return advanced;
  }

  /**
   * Marks that {@code possessingSide} just finished a possession in overtime and evaluates whether
   * the game has ended. Applies modified sudden death: both teams are guaranteed a possession in
   * the opening OT period (even if the opener is a TD); once both have possessed, pure sudden death
   * applies and any lead finalizes the result. Returns the updated state (possibly {@link
   * GameState.Phase#FINAL}); callers must honor {@code FINAL} and skip any follow-up PAT/kickoff.
   */
  static GameState concludeOvertimePossession(GameState state, Side possessingSide) {
    if (state.phase() != GameState.Phase.OVERTIME) {
      return state;
    }
    var ot = state.overtime().withPossessed(possessingSide);
    var tied = state.score().home() == state.score().away();
    if (ot.suddenDeath() && !tied) {
      return state.withOvertime(ot).withPhase(GameState.Phase.FINAL);
    }
    if (ot.bothPossessed()) {
      var enteredSd = ot.enterSuddenDeath();
      if (!tied) {
        return state.withOvertime(enteredSd).withPhase(GameState.Phase.FINAL);
      }
      return state.withOvertime(enteredSd);
    }
    return state.withOvertime(ot);
  }

  private GameState startOvertimePeriod(
      List<app.zoneblitz.gamesimulator.event.PlayEvent> out,
      GameState state,
      GameInputs inputs,
      int[] seq,
      SplittableRandomSource root,
      long gameKey,
      int round) {
    var periodSeconds =
        inputs.gameType() == GameType.PLAYOFFS
            ? PLAYOFF_OT_PERIOD_SECONDS
            : REGULAR_SEASON_OT_PERIOD_SECONDS;
    var otClock = new GameClock(4 + round, periodSeconds);
    var coinTossRng = root.split(gameKey ^ OT_COIN_TOSS_KEY ^ (long) round);
    var receiver = coinTossRng.nextDouble() < 0.5 ? Side.HOME : Side.AWAY;
    var withOt =
        state
            .withPhase(GameState.Phase.OVERTIME)
            .withClock(otClock)
            .withOvertimeRound(round)
            .withOvertime(GameState.OvertimeState.notStarted())
            .withTimeoutsReset();
    return scoring.emitKickoff(
        out, withOt, inputs, receiver, seq, root.split(gameKey ^ OT_KICKOFF_KEY ^ round));
  }

  private GameState endOfOvertimePeriod(
      List<app.zoneblitz.gamesimulator.event.PlayEvent> out,
      GameState state,
      GameInputs inputs,
      int[] seq,
      SplittableRandomSource root,
      long gameKey) {
    if (state.score().home() != state.score().away()) {
      return state.withPhase(GameState.Phase.FINAL);
    }
    if (inputs.gameType() == GameType.REGULAR_SEASON) {
      return state.withPhase(GameState.Phase.FINAL);
    }
    return startOvertimePeriod(out, state, inputs, seq, root, gameKey, state.overtimeRound() + 1);
  }
}
