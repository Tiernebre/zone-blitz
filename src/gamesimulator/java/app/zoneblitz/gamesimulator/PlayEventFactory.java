package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayId;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.resolver.PlayOutcome;
import app.zoneblitz.gamesimulator.resolver.RunOutcome;
import java.util.UUID;

/**
 * Maps resolver {@link PlayOutcome}s onto {@link PlayEvent}s given the pre-snap {@link GameState}
 * and derived {@link SnapAdvance}. Pure functions — no engine state.
 */
final class PlayEventFactory {

  private PlayEventFactory() {}

  static PlayEvent toEvent(
      PlayOutcome outcome,
      GameState state,
      GameClock clockAfter,
      Score scoreAfter,
      SnapAdvance advance,
      int sequence,
      GameId gameId) {
    var id = new PlayId(new UUID(gameId.value().getMostSignificantBits(), sequence));
    var preSnap = state.downAndDistance();
    var preSnapSpot = state.spot();
    var clockBefore = state.clock();
    var offenseEndSpot = offenseEndSpot(preSnapSpot, advance);
    var firstDown =
        !advance.touchdown()
            && advance.turnover() == SnapAdvance.Turnover.NONE
            && !advance.safety()
            && advance.offensiveYards() >= preSnap.yardsToGo();

    return switch (outcome) {
      case PassOutcome.PassComplete c ->
          new PlayEvent.PassComplete(
              id,
              gameId,
              sequence,
              preSnap,
              preSnapSpot,
              clockBefore,
              clockAfter,
              scoreAfter,
              c.qb(),
              c.target(),
              c.airYards(),
              c.yardsAfterCatch(),
              advance.offensiveYards(),
              offenseEndSpot,
              c.tackler(),
              c.defendersInCoverage(),
              advance.touchdown(),
              firstDown);
      case PassOutcome.PassIncomplete i ->
          new PlayEvent.PassIncomplete(
              id,
              gameId,
              sequence,
              preSnap,
              preSnapSpot,
              clockBefore,
              clockAfter,
              scoreAfter,
              i.qb(),
              i.target(),
              i.airYards(),
              i.reason(),
              i.defender());
      case PassOutcome.Sack s ->
          new PlayEvent.Sack(
              id,
              gameId,
              sequence,
              preSnap,
              preSnapSpot,
              clockBefore,
              clockAfter,
              scoreAfter,
              s.qb(),
              s.sackers(),
              Math.abs(advance.offensiveYards()),
              s.fumble());
      case PassOutcome.Scramble s ->
          new PlayEvent.Scramble(
              id,
              gameId,
              sequence,
              preSnap,
              preSnapSpot,
              clockBefore,
              clockAfter,
              scoreAfter,
              s.qb(),
              advance.offensiveYards(),
              offenseEndSpot,
              s.tackler(),
              s.slideOrOob(),
              advance.touchdown());
      case PassOutcome.Interception x ->
          new PlayEvent.Interception(
              id,
              gameId,
              sequence,
              preSnap,
              preSnapSpot,
              clockBefore,
              clockAfter,
              scoreAfter,
              x.qb(),
              x.intendedTarget(),
              x.interceptor(),
              Math.max(0, x.returnYards()),
              new FieldPosition(100 - advance.endYardLine()),
              advance.defensiveTouchdown());
      case RunOutcome.Run r ->
          new PlayEvent.Run(
              id,
              gameId,
              sequence,
              preSnap,
              preSnapSpot,
              clockBefore,
              clockAfter,
              scoreAfter,
              r.carrier(),
              r.concept(),
              advance.offensiveYards(),
              offenseEndSpot,
              r.tackler(),
              r.fumble(),
              advance.touchdown(),
              firstDown,
              0L);
    };
  }

  static Score scoreAfterPlay(Score current, Side offense, Side defense, SnapAdvance advance) {
    if (advance.touchdown()) {
      return current.plus(offense, 6);
    }
    if (advance.defensiveTouchdown()) {
      return current.plus(defense, 6);
    }
    if (advance.safety()) {
      return current.plus(defense, 2);
    }
    return current;
  }

  static PlayEvent.Safety safetyEvent(
      GameState state,
      GameId gameId,
      int sequence,
      FieldPosition freeKickSpot,
      Side concedingSide) {
    var id =
        new PlayId(new UUID(gameId.value().getMostSignificantBits(), 0x5A00L | (long) sequence));
    return new PlayEvent.Safety(
        id,
        gameId,
        sequence,
        state.downAndDistance(),
        state.spot(),
        state.clock(),
        state.clock(),
        state.score(),
        freeKickSpot,
        concedingSide);
  }

  static PlayEvent.EndOfQuarter endOfQuarterEvent(
      GameState state, GameId gameId, int sequence, int quarter) {
    var id =
        new PlayId(new UUID(gameId.value().getMostSignificantBits(), 0xEE00L | (long) sequence));
    var clock = new GameClock(quarter, 0);
    return new PlayEvent.EndOfQuarter(
        id,
        gameId,
        sequence,
        state.downAndDistance(),
        state.spot(),
        clock,
        clock,
        state.score(),
        quarter);
  }

  private static FieldPosition offenseEndSpot(FieldPosition preSnapSpot, SnapAdvance advance) {
    if (advance.turnover() != SnapAdvance.Turnover.NONE) {
      return new FieldPosition(100 - advance.endYardLine());
    }
    return new FieldPosition(advance.endYardLine());
  }
}
