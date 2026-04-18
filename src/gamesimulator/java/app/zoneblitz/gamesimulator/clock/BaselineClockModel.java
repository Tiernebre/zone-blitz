package app.zoneblitz.gamesimulator.clock;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.resolver.PlayOutcome;
import app.zoneblitz.gamesimulator.resolver.RunOutcome;

/**
 * Median inter-snap seconds from {@code data/bands/play-duration.json} (REG 2022-2024). Flat priors
 * — no situational adjustments yet (2-min drill, hurry-up, etc.).
 */
public final class BaselineClockModel implements ClockModel {

  private static final int RUN = 38;
  private static final int PASS_COMPLETE = 36;
  private static final int PASS_INCOMPLETE = 5;
  private static final int SACK = 38;
  private static final int SCRAMBLE_INBOUNDS = 39;
  private static final int SCRAMBLE_OOB = 35;
  private static final int INTERCEPTION = 8;

  @Override
  public int secondsConsumed(PlayOutcome outcome, GameState preSnap) {
    var raw =
        switch (outcome) {
          case PassOutcome.PassComplete c -> PASS_COMPLETE;
          case PassOutcome.PassIncomplete i -> PASS_INCOMPLETE;
          case PassOutcome.Sack s -> SACK;
          case PassOutcome.Scramble s -> s.slideOrOob() ? SCRAMBLE_OOB : SCRAMBLE_INBOUNDS;
          case PassOutcome.Interception x -> INTERCEPTION;
          case RunOutcome.Run r -> RUN;
        };
    return Math.min(raw, preSnap.clock().secondsRemaining());
  }
}
