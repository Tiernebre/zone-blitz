package app.zoneblitz.gamesimulator;

import java.util.List;
import java.util.Optional;

/**
 * Test double: resolves every call to a 5-yard {@link PlayEvent.Run}, consuming one RNG draw so
 * seed differences are observable in the emitted stream.
 */
final class ConstantPlayResolver implements PlayResolver {

  private final GameId gameId;
  private final PlayerId carrier;

  ConstantPlayResolver(GameId gameId, PlayerId carrier) {
    this.gameId = gameId;
    this.carrier = carrier;
  }

  @Override
  public PlayEvent resolve(
      PlayCaller.PlayCall call, GameState state, RandomSource rng, int sequence) {
    var draw = rng.nextLong();
    return new PlayEvent.Run(
        new PlayId(new java.util.UUID(0L, sequence)),
        gameId,
        sequence,
        state.downAndDistance(),
        state.spot(),
        state.clock(),
        state.clock(),
        state.score(),
        carrier,
        RunConcept.INSIDE_ZONE,
        5,
        new FieldPosition(state.spot().yardLine() + 5),
        Optional.<PlayerId>empty(),
        Optional.<FumbleOutcome>empty(),
        false,
        false,
        draw);
  }

  static List<PlayerId> noDefenders() {
    return List.of();
  }
}
