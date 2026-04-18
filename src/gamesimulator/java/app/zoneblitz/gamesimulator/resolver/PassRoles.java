package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.roster.Player;
import java.util.List;
import java.util.Objects;

/**
 * Per-snap role buckets for pass-play matchup aggregates.
 *
 * <p>Role is assigned by the offensive play call, not the depth chart: a corner blitz moves the CB
 * out of {@link #coverageDefenders} and into {@link #passRushers}; max protect moves a back out of
 * {@link #routeRunners} into {@link #passBlockers}. The blitz tradeoff — more rushers but fewer
 * coverage defenders — falls out of the aggregate sizes without any special-case branches.
 *
 * <p>Run-play roles live in {@link RunRoles}; each play shape owns its own bucket record so
 * consumers pattern-match against the buckets they actually use.
 */
public record PassRoles(
    List<Player> passRushers,
    List<Player> passBlockers,
    List<Player> routeRunners,
    List<Player> coverageDefenders) {

  public PassRoles {
    Objects.requireNonNull(passRushers, "passRushers");
    Objects.requireNonNull(passBlockers, "passBlockers");
    Objects.requireNonNull(routeRunners, "routeRunners");
    Objects.requireNonNull(coverageDefenders, "coverageDefenders");
    passRushers = List.copyOf(passRushers);
    passBlockers = List.copyOf(passBlockers);
    routeRunners = List.copyOf(routeRunners);
    coverageDefenders = List.copyOf(coverageDefenders);
  }
}
