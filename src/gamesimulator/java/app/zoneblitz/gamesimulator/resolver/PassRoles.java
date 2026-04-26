package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.role.DefensiveRole;
import app.zoneblitz.gamesimulator.role.OffensiveRole;
import app.zoneblitz.gamesimulator.role.RoleAssignmentPair;
import app.zoneblitz.gamesimulator.roster.Player;
import java.util.ArrayList;
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
 *
 * <p>Construction comes from a {@link RoleAssignmentPair} via {@link #from(RoleAssignmentPair)} — a
 * fine-grained role assignment is bucketed into the four legacy aggregates for consumers that still
 * operate on flat lists ({@code TargetSelector}, {@code PressureModel}, the resolver's interception
 * picker). Bucket membership matches the legacy position-based assigner.
 *
 * <p>Phase 10.5 follow-up: deletable once {@code TargetSelector}, {@code PressureModel}, and {@code
 * MatchupPassResolver}'s interception picker / target resolver / pressure resolver consume {@link
 * RoleAssignmentPair} directly. Mechanical refactor (~15 files) with no architectural blocker.
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

  public static PassRoles from(RoleAssignmentPair pair) {
    Objects.requireNonNull(pair, "pair");
    var passBlockers = new ArrayList<Player>();
    var routeRunners = new ArrayList<Player>();
    pair.offense()
        .players()
        .forEach(
            (role, player) -> {
              if (isPassBlocker(role)) {
                passBlockers.add(player);
              } else if (isRouteRunner(role)) {
                routeRunners.add(player);
              }
            });

    var passRushers = new ArrayList<Player>();
    var coverageDefenders = new ArrayList<Player>();
    pair.defense()
        .players()
        .forEach(
            (role, player) -> {
              if (isPassRusher(role)) {
                passRushers.add(player);
              } else if (isCoverageDefender(role)) {
                coverageDefenders.add(player);
              }
            });

    return new PassRoles(passRushers, passBlockers, routeRunners, coverageDefenders);
  }

  public static boolean isPassBlocker(OffensiveRole role) {
    return switch (role) {
      case LT, LG, C, RG, RT, FB_LEAD -> true;
      default -> false;
    };
  }

  public static boolean isRouteRunner(OffensiveRole role) {
    return switch (role) {
      case X_WR, Z_WR, SLOT_WR, INLINE_TE, FLEX_TE, H_BACK, RB_RUSH, RB_RECEIVE, RB_PROTECT -> true;
      default -> false;
    };
  }

  public static boolean isPassRusher(DefensiveRole role) {
    return switch (role) {
      case NOSE, THREE_TECH, FIVE_TECH, EDGE, STAND_UP_OLB -> true;
      default -> false;
    };
  }

  public static boolean isCoverageDefender(DefensiveRole role) {
    return switch (role) {
      case OUTSIDE_CB, SLOT_CB, DEEP_S, BOX_S, DIME_LB, MIKE_LB, WILL_LB, SAM_LB -> true;
      default -> false;
    };
  }
}
