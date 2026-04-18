package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.resolver.PlayOutcome;
import app.zoneblitz.gamesimulator.resolver.RunOutcome;
import java.util.Optional;

/**
 * Post-snap derivation. Resolvers are intentionally field-blind and produce raw yardage; {@link
 * SnapAdvance#derive} is the single seam that knows the field has ends — it clamps against both
 * goal lines, detects touchdowns and safeties, and resolves turnovers.
 *
 * <p>Yard-line convention matches {@link app.zoneblitz.gamesimulator.event.FieldPosition}: 0..100
 * measured from the possessing team's own goal line. {@link #endYardLine} is always expressed from
 * the perspective of whoever has the ball after the snap — on a turnover the frame flips, on a TD
 * the value is pinned to 100 (scoring team's opponent's goal), and on a safety it's pinned to 0.
 */
record SnapAdvance(
    int offensiveYards,
    int endYardLine,
    boolean touchdown,
    boolean defensiveTouchdown,
    boolean safety,
    Turnover turnover) {

  enum Turnover {
    NONE,
    INTERCEPTION,
    FUMBLE_LOST
  }

  static SnapAdvance derive(PlayOutcome outcome, int preYardLine) {
    return switch (outcome) {
      case RunOutcome.Run r -> fromRushYards(r.yards(), preYardLine, r.fumble());
      case PassOutcome.PassComplete pc ->
          fromRushYards(pc.totalYards(), preYardLine, Optional.empty());
      case PassOutcome.Scramble s -> fromRushYards(s.yards(), preYardLine, Optional.empty());
      case PassOutcome.PassIncomplete ignored ->
          new SnapAdvance(0, preYardLine, false, false, false, Turnover.NONE);
      case PassOutcome.Sack s -> fromSack(s, preYardLine);
      case PassOutcome.Interception i -> fromInterception(i.returnYards(), preYardLine);
    };
  }

  private static SnapAdvance fromRushYards(
      int yards,
      int preYardLine,
      Optional<app.zoneblitz.gamesimulator.event.FumbleOutcome> fumble) {
    var rawEnd = preYardLine + yards;
    if (rawEnd >= 100) {
      return new SnapAdvance(100 - preYardLine, 100, true, false, false, Turnover.NONE);
    }
    if (rawEnd <= 0) {
      // Offensive player went down in their own end zone.
      return new SnapAdvance(-preYardLine, 0, false, false, true, Turnover.NONE);
    }
    if (fumble.isPresent() && fumble.get().defenseRecovered()) {
      // Defense recovers at the end spot, then returns toward the old offense's end zone.
      var newOffenseYl = 100 - rawEnd + fumble.get().returnYards();
      return fumbleReturn(newOffenseYl, yards);
    }
    return new SnapAdvance(yards, rawEnd, false, false, false, Turnover.NONE);
  }

  private static SnapAdvance fromSack(PassOutcome.Sack s, int preYardLine) {
    var rawEnd = preYardLine - Math.abs(s.yardsLost());
    if (s.fumble().isPresent() && s.fumble().get().defenseRecovered()) {
      var clamped = Math.max(0, rawEnd);
      var newOffenseYl = 100 - clamped + s.fumble().get().returnYards();
      return fumbleReturn(newOffenseYl, -Math.abs(s.yardsLost()));
    }
    if (rawEnd <= 0) {
      return new SnapAdvance(-preYardLine, 0, false, false, true, Turnover.NONE);
    }
    return new SnapAdvance(-Math.abs(s.yardsLost()), rawEnd, false, false, false, Turnover.NONE);
  }

  private static SnapAdvance fromInterception(int returnYards, int preYardLine) {
    // Interception spot is the line of scrimmage (air-yards tracking is deferred). From the new
    // offense's frame, that's 100 - preYardLine yards from their own goal; returns drive toward
    // the old offense's end zone.
    var newOffenseYl = 100 - preYardLine + returnYards;
    if (newOffenseYl >= 100) {
      return new SnapAdvance(0, 100, false, true, false, Turnover.INTERCEPTION);
    }
    return new SnapAdvance(
        0, Math.max(1, newOffenseYl), false, false, false, Turnover.INTERCEPTION);
  }

  private static SnapAdvance fumbleReturn(int newOffenseYl, int offensiveYards) {
    if (newOffenseYl >= 100) {
      return new SnapAdvance(offensiveYards, 100, false, true, false, Turnover.FUMBLE_LOST);
    }
    return new SnapAdvance(
        offensiveYards, Math.max(1, newOffenseYl), false, false, false, Turnover.FUMBLE_LOST);
  }
}
