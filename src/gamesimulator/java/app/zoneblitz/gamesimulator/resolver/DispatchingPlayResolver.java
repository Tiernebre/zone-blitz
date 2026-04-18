package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.resolver.pass.PassResolver;
import app.zoneblitz.gamesimulator.resolver.run.RunResolver;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.Locale;
import java.util.Objects;

/**
 * Default {@link PlayResolver}: routes to a {@link PassResolver} or {@link RunResolver} based on
 * the {@link PlayCaller.PlayCall} kind.
 *
 * <p>{@code PlayCall} is a string-kinded placeholder today; this dispatcher will grow a sealed
 * hierarchy dispatch when the decision layer's real play-call types land.
 */
public final class DispatchingPlayResolver implements PlayResolver {

  private final PassResolver pass;
  private final RunResolver run;

  public DispatchingPlayResolver(PassResolver pass, RunResolver run) {
    this.pass = Objects.requireNonNull(pass, "pass");
    this.run = Objects.requireNonNull(run, "run");
  }

  @Override
  public PlayOutcome resolve(
      PlayCaller.PlayCall call,
      GameState state,
      OffensivePersonnel offense,
      DefensivePersonnel defense,
      RandomSource rng) {
    Objects.requireNonNull(call, "call");
    var kind = call.kind() == null ? "" : call.kind().toLowerCase(Locale.ROOT);
    return switch (kind) {
      case "pass" -> pass.resolve(call, state, offense, defense, rng);
      case "run" -> run.resolve(call, state, offense, defense, rng);
      default -> throw new IllegalArgumentException("Unknown play call kind: " + call.kind());
    };
  }
}
