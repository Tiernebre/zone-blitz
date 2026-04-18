package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayerId;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Post-game output bundle: the full {@link PlayEvent} stream plus end-of-game accumulated stats
 * that are derived from {@link GameState} rather than from individual events. Today only {@link
 * #snapCounts() snap counts} are surfaced; future stats (drive summaries, time of possession,
 * fatigue residuals) join here without changing the {@link SimulateGame#simulate} stream contract.
 */
public record GameSummary(List<PlayEvent> events, Map<PlayerId, Integer> snapCounts) {

  public GameSummary {
    Objects.requireNonNull(events, "events");
    Objects.requireNonNull(snapCounts, "snapCounts");
    events = List.copyOf(events);
    snapCounts = Map.copyOf(snapCounts);
  }
}
