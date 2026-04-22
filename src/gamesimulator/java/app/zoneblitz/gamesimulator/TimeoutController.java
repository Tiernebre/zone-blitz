package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayId;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Resolves pre-snap timeout decisions. One call per snap opportunity: asks the {@link
 * TimeoutDecider} whether either sideline wants to burn a timeout, and — if so and the requesting
 * side still has timeouts available — emits a {@link PlayEvent.Timeout} event and decrements that
 * side's remaining-timeout count.
 */
final class TimeoutController {

  private static final long TIMEOUT_SPLIT_KEY = 0xF011_7011L;

  private final TimeoutDecider decider;

  TimeoutController(TimeoutDecider decider) {
    this.decider = Objects.requireNonNull(decider, "decider");
  }

  GameState maybeCallTimeout(
      List<PlayEvent> out,
      GameState state,
      GameInputs inputs,
      int[] seq,
      SplittableRandomSource root,
      long gameKey) {
    var rng = root.split(gameKey ^ TIMEOUT_SPLIT_KEY ^ ((long) seq[0] << 16));
    var called = decider.decide(state, inputs.homeCoach(), inputs.awayCoach(), rng);
    if (called.isEmpty()) {
      return state;
    }
    var side = called.get();
    if (state.timeoutsFor(side) <= 0) {
      return state;
    }
    var sequence = seq[0]++;
    var id =
        new PlayId(
            new UUID(inputs.gameId().value().getMostSignificantBits(), 0xA700L | (long) sequence));
    var event =
        new PlayEvent.Timeout(
            id,
            inputs.gameId(),
            sequence,
            state.downAndDistance(),
            state.spot(),
            state.clock(),
            state.clock(),
            state.score(),
            side);
    out.add(event);
    return state.withTimeoutUsed(side);
  }
}
