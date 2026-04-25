package app.zoneblitz.scouting;

import app.zoneblitz.gamesimulator.role.DefensiveRole;
import app.zoneblitz.gamesimulator.role.OffensiveRole;
import app.zoneblitz.gamesimulator.role.Role;
import app.zoneblitz.gamesimulator.role.RoleDemand;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.scheme.DefaultRoleDemands;
import app.zoneblitz.gamesimulator.scheme.ResolvedScheme;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;

/**
 * Default {@link EvaluateSchemeFit} implementation. Walks every {@link Role} eligible for the
 * player's {@link app.zoneblitz.gamesimulator.roster.Position}, scores it against each scheme's
 * demand table (falling back to {@link DefaultRoleDemands} when a scheme hasn't authored its own
 * demands yet), and returns the best fit plus alternates.
 *
 * <p>Score math: average of skill, physical, and tendency centered scores from the role demand,
 * mapped from {@code [-1, +1]} to {@code [0, 100]}. Tier comes from percentile rank against the
 * comparison pool's distribution at the same role.
 */
@Service
public final class EvaluateSchemeFitUseCase implements EvaluateSchemeFit {

  @Override
  public SchemeFit evaluate(
      Player player, ResolvedScheme scheme, Iterable<Player> roleComparisonPool) {
    Objects.requireNonNull(player, "player");
    Objects.requireNonNull(scheme, "scheme");
    Objects.requireNonNull(roleComparisonPool, "roleComparisonPool");

    var pool = collect(roleComparisonPool);

    var fits = new ArrayList<RoleFit>();
    for (var role : eligibleRolesFor(player)) {
      var demand = lookupDemand(scheme, role);
      var score = scoreRole(player, demand);
      var tier = tierForRole(role, score, pool, scheme);
      fits.add(new RoleFit(role, score, tier));
    }
    if (fits.isEmpty()) {
      var fallback = new RoleFit(OffensiveRole.QB_POCKET, 50.0, FitTier.D);
      return new SchemeFit(fallback, List.of(), 0.0);
    }

    fits.sort(Comparator.comparingDouble(RoleFit::score).reversed());
    var bestFit = fits.get(0);
    var alternates = fits.subList(1, fits.size());
    var versatility = computeVersatility(fits);
    return new SchemeFit(bestFit, alternates, versatility);
  }

  private static List<Role> eligibleRolesFor(Player player) {
    var eligible = new ArrayList<Role>();
    for (var role : OffensiveRole.values()) {
      if (role.basePosition() == player.position()) {
        eligible.add(role);
      }
    }
    for (var role : DefensiveRole.values()) {
      if (role.basePosition() == player.position()) {
        eligible.add(role);
      }
    }
    return eligible;
  }

  private static RoleDemand lookupDemand(ResolvedScheme scheme, Role role) {
    var off = scheme.offense().demandTable().defaultsByRole().get(role);
    if (off != null) {
      return off;
    }
    var def = scheme.defense().demandTable().defaultsByRole().get(role);
    if (def != null) {
      return def;
    }
    return DefaultRoleDemands.forRole(role);
  }

  private static double scoreRole(Player player, RoleDemand demand) {
    var n = 0;
    var sum = 0.0;
    if (!demand.physicalWeights().isEmpty()) {
      sum += demand.physicalScore(player);
      n++;
    }
    if (!demand.skillWeights().isEmpty()) {
      sum += demand.skillScore(player);
      n++;
    }
    if (!demand.tendencyWeights().isEmpty()) {
      sum += demand.tendencyScore(player);
      n++;
    }
    if (n == 0) {
      return 50.0;
    }
    var centered = sum / n;
    return clamp(50.0 + centered * 50.0, 0.0, 100.0);
  }

  private static FitTier tierForRole(
      Role role, double score, List<Player> pool, ResolvedScheme scheme) {
    if (pool.isEmpty()) {
      return FitTier.fromPercentile(0.5);
    }
    var demand = lookupDemand(scheme, role);
    var below = 0;
    var equal = 0;
    for (var other : pool) {
      var otherScore = scoreRole(other, demand);
      if (otherScore < score) {
        below++;
      } else if (otherScore == score) {
        equal++;
      }
    }
    var percentile = (below + 0.5 * equal) / (double) pool.size();
    return FitTier.fromPercentile(percentile);
  }

  private static double computeVersatility(List<RoleFit> fits) {
    if (fits.size() < 2) {
      return 0.0;
    }
    var mean = 0.0;
    for (var fit : fits) {
      mean += fit.score();
    }
    mean /= fits.size();
    var variance = 0.0;
    for (var fit : fits) {
      var diff = fit.score() - mean;
      variance += diff * diff;
    }
    variance /= fits.size();
    var stddev = Math.sqrt(variance);
    if (mean <= 0.0) {
      return 0.0;
    }
    var coefficient = stddev / mean;
    return clamp(1.0 - coefficient, 0.0, 1.0);
  }

  private static List<Player> collect(Iterable<Player> players) {
    var list = new ArrayList<Player>();
    for (var p : players) {
      list.add(p);
    }
    return List.copyOf(list);
  }

  private static double clamp(double v, double lo, double hi) {
    return Math.max(lo, Math.min(hi, v));
  }
}
