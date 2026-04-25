package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.role.DefensiveRole;
import app.zoneblitz.gamesimulator.role.OffensiveRole;
import app.zoneblitz.gamesimulator.role.RoleAssigner;
import app.zoneblitz.gamesimulator.roster.Player;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Bridge between the new fine-grained {@link RoleAssigner} and the legacy {@link PassRoles} bucket
 * aggregation that {@code RoleMatchupPassShift} consumes. Internally calls the delegate role
 * assigner, then collapses the fine-grained role assignment back into the four bucketed lists.
 *
 * <p>Bucket mapping:
 *
 * <ul>
 *   <li>{@link OffensiveRole#LT}, {@code LG}, {@code C}, {@code RG}, {@code RT}, {@code FB_LEAD} →
 *       {@link PassRoles#passBlockers}.
 *   <li>WR / TE / RB roles (X/Z/SLOT, INLINE/FLEX/H_BACK, RB_RUSH/RB_RECEIVE/RB_PROTECT) → {@link
 *       PassRoles#routeRunners}.
 *   <li>{@link DefensiveRole#NOSE}, {@code THREE_TECH}, {@code FIVE_TECH}, {@code EDGE}, {@code
 *       STAND_UP_OLB} → {@link PassRoles#passRushers}.
 *   <li>CB / S / LB coverage roles (OUTSIDE_CB, SLOT_CB, DEEP_S, BOX_S, DIME_LB, MIKE_LB, WILL_LB,
 *       SAM_LB) → {@link PassRoles#coverageDefenders}.
 * </ul>
 *
 * <p>Phase 4 keeps the bucket flattening behavior identical to {@link
 * PositionBasedPassRoleAssigner} so calibration tests don't drift. Phase 5's role-keyed shift will
 * read the fine-grained assignment directly and skip the flattening.
 */
public final class SchemeAwarePassRoleAssigner implements PassRoleAssigner {

  private final RoleAssigner delegate;

  public SchemeAwarePassRoleAssigner(RoleAssigner delegate) {
    this.delegate = Objects.requireNonNull(delegate, "delegate");
  }

  @Override
  public PassRoles assign(
      PlayCaller.PlayCall call, OffensivePersonnel offense, DefensivePersonnel defense) {
    var pair = delegate.assign(call, offense, defense);

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

    return new PassRoles(
        List.copyOf(passRushers),
        List.copyOf(passBlockers),
        List.copyOf(routeRunners),
        List.copyOf(coverageDefenders));
  }

  private static boolean isPassBlocker(OffensiveRole role) {
    return switch (role) {
      case LT, LG, C, RG, RT, FB_LEAD -> true;
      default -> false;
    };
  }

  private static boolean isRouteRunner(OffensiveRole role) {
    return switch (role) {
      case X_WR, Z_WR, SLOT_WR, INLINE_TE, FLEX_TE, H_BACK, RB_RUSH, RB_RECEIVE, RB_PROTECT -> true;
      default -> false;
    };
  }

  private static boolean isPassRusher(DefensiveRole role) {
    return switch (role) {
      case NOSE, THREE_TECH, FIVE_TECH, EDGE, STAND_UP_OLB -> true;
      default -> false;
    };
  }

  private static boolean isCoverageDefender(DefensiveRole role) {
    return switch (role) {
      case OUTSIDE_CB, SLOT_CB, DEEP_S, BOX_S, DIME_LB, MIKE_LB, WILL_LB, SAM_LB -> true;
      default -> false;
    };
  }
}
