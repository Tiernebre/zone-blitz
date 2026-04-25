package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.resolver.PlayOutcome;
import app.zoneblitz.gamesimulator.resolver.PlayResolver;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.List;
import java.util.Optional;

/**
 * Test double: resolves every call to a constant {@link PassOutcome.PassComplete}, consuming one
 * RNG draw so seed differences are observable in the emitted stream. The draw is folded into {@code
 * totalYards} (modulo 20) so the resulting {@link
 * app.zoneblitz.gamesimulator.event.PlayEvent.PassComplete} values diverge across seeds.
 */
final class ConstantPlayResolver implements PlayResolver {

  private final PlayerId qb;
  private final PlayerId target;

  ConstantPlayResolver(PlayerId qb, PlayerId target) {
    this.qb = qb;
    this.target = target;
  }

  @Override
  public PlayOutcome resolve(
      PlayCaller.PlayCall call,
      GameState state,
      OffensivePersonnel offense,
      DefensivePersonnel defense,
      RandomSource rng) {
    var draw = rng.nextLong();
    var yards = (int) Math.floorMod(draw, 20);
    return new PassOutcome.PassComplete(
        qb, target, yards, 0, yards, Optional.empty(), List.of(), false);
  }

  static List<PlayerId> noDefenders() {
    return List.of();
  }
}
