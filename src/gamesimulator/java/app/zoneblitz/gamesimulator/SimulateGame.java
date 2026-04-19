package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.event.PlayEvent;
import java.util.stream.Stream;

/**
 * Use case: simulate a single game end-to-end and emit a deterministic stream of {@link
 * PlayEvent}s. Reproducibility contract: for the same {@link GameInputs} (including seed), the
 * emitted stream is byte-identical across processes.
 */
public interface SimulateGame {

  /**
   * Simulate the supplied game. The returned stream is finite; callers may collect it or consume it
   * lazily. Events carry monotonically increasing {@code sequence} values starting at 0.
   */
  Stream<PlayEvent> simulate(GameInputs inputs);

  /**
   * Simulate the supplied game and return both the event stream (collected) and post-game
   * accumulated stats (snap counts, etc.) derived from the terminal {@link GameState}. The default
   * implementation collects {@link #simulate} and returns an empty stats bundle; engines that track
   * snap participation override to surface the real numbers.
   */
  default GameSummary summarize(GameInputs inputs) {
    return new GameSummary(simulate(inputs).toList(), java.util.Map.of());
  }
}
