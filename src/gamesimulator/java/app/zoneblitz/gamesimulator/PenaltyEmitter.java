package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayId;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.penalty.PenaltyDraw;
import app.zoneblitz.gamesimulator.penalty.PenaltyEnforcement;
import app.zoneblitz.gamesimulator.penalty.PenaltyEnforcer;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Emits pre-snap, live-ball, and post-play penalty events and threads the resulting {@link
 * GameState} forward. Isolates {@link PenaltyEnforcer} enforcement mechanics from the main engine
 * loop.
 */
final class PenaltyEmitter {

  private PenaltyEmitter() {}

  static GameState emitPreSnap(
      List<PlayEvent> out,
      GameState state,
      PenaltyDraw.PreSnap draw,
      int[] seq,
      GameId gameId,
      Side offenseSide) {
    var sequence = seq[0]++;
    var preYL = state.spot().yardLine();
    var applied = PenaltyEnforcer.apply(state.downAndDistance(), preYL, preYL, offenseSide, draw);
    var event =
        new PlayEvent.Penalty(
            penaltyId(gameId, sequence),
            gameId,
            sequence,
            state.downAndDistance(),
            state.spot(),
            state.clock(),
            state.clock(),
            state.score(),
            draw.type(),
            draw.against(),
            draw.committedBy(),
            applied.yardsApplied(),
            true,
            Optional.empty());
    out.add(event);
    return afterPenalty(state, applied, state.clock(), offenseSide);
  }

  static GameState emitLiveBall(
      List<PlayEvent> out,
      GameState state,
      PlayEvent underlying,
      PenaltyDraw.LiveBall draw,
      GameClock clockAfter,
      int sequence,
      GameId gameId,
      Side offenseSide) {
    var preYL = state.spot().yardLine();
    // Live-ball enforcement measures from END_OF_PLAY for personal fouls / post-possession flags;
    // previous-spot for offensive fouls. The enforcer reads `spot` off the draw's enforcement
    // and picks the right basis.
    var basis =
        draw.enforcement().spot() == PenaltyEnforcement.Spot.END_OF_PLAY
            ? endYardLine(underlying)
            : preYL;
    var applied = PenaltyEnforcer.apply(state.downAndDistance(), preYL, basis, offenseSide, draw);
    var event =
        new PlayEvent.Penalty(
            penaltyId(gameId, sequence),
            gameId,
            sequence,
            state.downAndDistance(),
            state.spot(),
            state.clock(),
            clockAfter,
            state.score(),
            draw.type(),
            draw.against(),
            draw.committedBy(),
            applied.yardsApplied(),
            draw.enforcement().replayDown(),
            Optional.of(underlying));
    out.add(event);
    return afterPenalty(state, applied, clockAfter, offenseSide);
  }

  static GameState emitPostPlay(
      List<PlayEvent> out,
      GameState state,
      PenaltyDraw.PostPlay draw,
      int[] seq,
      GameId gameId,
      Side offenseSide) {
    var sequence = seq[0]++;
    var spot = state.spot().yardLine();
    var applied = PenaltyEnforcer.apply(state.downAndDistance(), spot, spot, offenseSide, draw);
    var event =
        new PlayEvent.Penalty(
            penaltyId(gameId, sequence),
            gameId,
            sequence,
            state.downAndDistance(),
            state.spot(),
            state.clock(),
            state.clock(),
            state.score(),
            draw.type(),
            draw.against(),
            draw.committedBy(),
            applied.yardsApplied(),
            false,
            Optional.empty());
    out.add(event);
    return afterPenalty(state, applied, state.clock(), offenseSide);
  }

  /**
   * Simple accept/decline: the non-offending side accepts when doing so hurts the offense more (or
   * helps them less) than letting the play stand.
   */
  static boolean shouldAccept(PenaltyDraw.LiveBall draw, SnapAdvance advance, Side offenseSide) {
    var againstOffense = draw.against() == offenseSide;
    var playYards = advance.offensiveYards();
    var penaltyDelta = againstOffense ? -draw.yards() : draw.yards();
    var autoFirstDownBonus = draw.enforcement().autoFirstDown() ? 15 : 0;
    var penaltyEffective = penaltyDelta + (againstOffense ? 0 : autoFirstDownBonus);
    return againstOffense ? penaltyEffective < playYards : penaltyEffective > playYards;
  }

  private static GameState afterPenalty(
      GameState state, PenaltyEnforcer.Applied applied, GameClock clockAfter, Side offenseSide) {
    return switch (applied) {
      case PenaltyEnforcer.Applied.Next n ->
          new GameState(
              state.score(),
              clockAfter,
              n.nextDownAndDistance(),
              n.newSpot(),
              offenseSide,
              state.drive(),
              state.fatigueSnapCounts(),
              state.injuredPlayers(),
              state.homeTimeouts(),
              state.awayTimeouts(),
              state.phase(),
              state.overtimeRound(),
              state.overtime());
      case PenaltyEnforcer.Applied.TurnoverOnDowns t ->
          state
              .withClock(clockAfter)
              .withPossessionAndSpot(
                  offenseSide == Side.HOME ? Side.AWAY : Side.HOME,
                  new FieldPosition(100 - t.newSpot().yardLine()));
    };
  }

  private static int endYardLine(PlayEvent event) {
    // Best-effort: read from known event types that carry an end-of-play spot in offense frame.
    return switch (event) {
      case PlayEvent.Run r -> r.endSpot().yardLine();
      case PlayEvent.PassComplete c -> c.endSpot().yardLine();
      case PlayEvent.Scramble s -> s.endSpot().yardLine();
      // Incompletions/sacks don't advance; fall back to pre-snap spot.
      default -> event.preSnapSpot().yardLine();
    };
  }

  private static PlayId penaltyId(GameId gameId, int sequence) {
    return new PlayId(new UUID(gameId.value().getMostSignificantBits(), 0xF100L | (long) sequence));
  }
}
