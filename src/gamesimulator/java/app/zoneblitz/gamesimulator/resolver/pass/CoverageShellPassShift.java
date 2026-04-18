package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.formation.CoverageShell;
import app.zoneblitz.gamesimulator.resolver.pass.MatchupPassResolver.PassMatchupShift;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;

/**
 * Coverage-shell contribution to the pass matchup shift.
 *
 * <p>Takes a per-shell shift table: each coverage call maps to a signed scalar added to the
 * matchup. Starting table is all zeros — the infrastructure is in place for the calibration harness
 * to tune shell-vs-offense biases once pass concepts arrive and concept×shell fit can be modeled. A
 * missing shell defaults to {@code 0.0}.
 */
public final class CoverageShellPassShift implements PassMatchupShift {

  private final Map<CoverageShell, Double> shiftsByShell;

  public CoverageShellPassShift() {
    this(Map.of());
  }

  public CoverageShellPassShift(Map<CoverageShell, Double> shiftsByShell) {
    Objects.requireNonNull(shiftsByShell, "shiftsByShell");
    this.shiftsByShell = new EnumMap<>(CoverageShell.class);
    this.shiftsByShell.putAll(shiftsByShell);
  }

  @Override
  public double compute(PassMatchupContext context, RandomSource rng) {
    Objects.requireNonNull(context, "context");
    return shiftsByShell.getOrDefault(context.shell(), 0.0);
  }
}
