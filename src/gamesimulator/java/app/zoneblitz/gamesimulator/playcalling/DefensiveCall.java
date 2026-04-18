package app.zoneblitz.gamesimulator.playcalling;

import app.zoneblitz.gamesimulator.formation.CoverageShell;
import java.util.Objects;

/**
 * The defensive pre-snap call: coverage shell, man/zone bucket, pressure package, and personnel.
 * Produced by {@link DefensiveCallSelector} each snap and consumed by the resolvers' matchup shifts
 * (phase-5 hook) so a dialed-up blitz produces more sacks, a Cover-0 produces more
 * completions-or-bust, etc.
 *
 * <p>{@code extraRushers} is the count above the 4-man baseline: {@code 0} = 4-man rush, {@code 1}
 * = 5-man, up to {@code 3} = 7-man (all-out). Negative values (drop 8) aren't modelled yet; future
 * extension if coverage-first calls become worth distinguishing.
 */
public record DefensiveCall(
    CoverageShell shell, ManZone manZone, int extraRushers, DefensivePackage personnelPackage) {

  public DefensiveCall {
    Objects.requireNonNull(shell, "shell");
    Objects.requireNonNull(manZone, "manZone");
    Objects.requireNonNull(personnelPackage, "personnelPackage");
    if (extraRushers < 0 || extraRushers > 3) {
      throw new IllegalArgumentException("extraRushers must be in [0, 3], got " + extraRushers);
    }
  }

  /** League-neutral defensive call: 4-man rush, Cover-3 zone, nickel personnel. */
  public static DefensiveCall neutral() {
    return new DefensiveCall(CoverageShell.COVER_3, ManZone.ZONE, 0, DefensivePackage.NICKEL);
  }
}
