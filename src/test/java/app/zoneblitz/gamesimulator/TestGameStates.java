package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import java.util.List;
import java.util.Map;

/**
 * Test-only factory for {@link GameState} instances. Lives in the parent package so tests in
 * sibling packages (e.g. {@code playcalling}) can construct states without forcing {@code
 * DriveState} / {@code Phase} to become public API.
 */
public final class TestGameStates {

  private TestGameStates() {}

  public static GameState of(
      int down,
      int yardsToGo,
      int yardLine,
      int quarter,
      int secondsRemaining,
      int homeScore,
      int awayScore,
      Side possession) {
    return new GameState(
        new Score(homeScore, awayScore),
        new GameClock(quarter, secondsRemaining),
        new DownAndDistance(down, yardsToGo),
        new FieldPosition(yardLine),
        possession,
        new GameState.DriveState(1, 0, 0, Side.HOME),
        Map.of(),
        List.of(),
        3,
        3,
        GameState.Phase.REGULATION,
        0,
        GameState.OvertimeState.notStarted());
  }

  public static GameState neutral(int down, int yardsToGo, int yardLine) {
    return of(down, yardsToGo, yardLine, 1, 600, 0, 0, Side.HOME);
  }
}
