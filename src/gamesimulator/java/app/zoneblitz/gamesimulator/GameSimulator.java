package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import java.util.Objects;
import java.util.stream.Stream;

/**
 * F1 walking-skeleton implementation of {@link SimulateGame}. Loops a fixed number of snaps from
 * the supplied {@link PlayCaller}, resolves each via the supplied {@link PlayResolver}, and emits
 * one event per snap. Bands, matchup math, and the model cluster are all out of scope.
 */
final class GameSimulator implements SimulateGame {

  private static final int DEFAULT_SNAPS = 130;

  private final PlayCaller caller;
  private final PlayResolver resolver;
  private final int snaps;

  GameSimulator(PlayCaller caller, PlayResolver resolver) {
    this(caller, resolver, DEFAULT_SNAPS);
  }

  GameSimulator(PlayCaller caller, PlayResolver resolver, int snaps) {
    this.caller = Objects.requireNonNull(caller, "caller");
    this.resolver = Objects.requireNonNull(resolver, "resolver");
    this.snaps = snaps;
  }

  @Override
  public Stream<PlayEvent> simulate(GameInputs inputs) {
    Objects.requireNonNull(inputs, "inputs");
    var seed = inputs.seed().orElse(0L);
    var root = new SplittableRandomSource(seed);
    var gameKey = (long) inputs.gameId().value().hashCode();
    return Stream.iterate(0, i -> i + 1)
        .limit(snaps)
        .map(
            i -> {
              var snapRng = root.split(gameKey ^ ((long) i << 32));
              var state = GameState.initial();
              var call = caller.call(state);
              return resolver.resolve(call, state, snapRng, i);
            });
  }
}
