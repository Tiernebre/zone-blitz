package app.zoneblitz.gamesimulator.output;

import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.TeamId;
import java.time.Duration;
import java.util.Objects;

/**
 * Aggregate stats for a single offensive drive. {@code startSequence} / {@code endSequence} are the
 * {@link app.zoneblitz.gamesimulator.event.PlayEvent#sequence()} values of the drive's first and
 * last events, inclusive.
 */
public record DriveStats(
    GameId game,
    TeamId offense,
    int startSequence,
    int endSequence,
    FieldPosition startSpot,
    FieldPosition endSpot,
    int plays,
    int yards,
    Duration timeOfPossession,
    DriveResult result) {

  public DriveStats {
    Objects.requireNonNull(game, "game");
    Objects.requireNonNull(offense, "offense");
    Objects.requireNonNull(startSpot, "startSpot");
    Objects.requireNonNull(endSpot, "endSpot");
    Objects.requireNonNull(timeOfPossession, "timeOfPossession");
    Objects.requireNonNull(result, "result");
  }
}
