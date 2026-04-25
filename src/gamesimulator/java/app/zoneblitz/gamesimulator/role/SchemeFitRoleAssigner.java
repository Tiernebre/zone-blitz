package app.zoneblitz.gamesimulator.role;

import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.scheme.OffensiveScheme;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Objects;

/**
 * Default {@link RoleAssigner}. Maps players to fine-grained roles by walking each side's personnel
 * and stamping roles in a deterministic order — all CBs in personnel order get {@code OUTSIDE_CB /
 * OUTSIDE_CB / SLOT_CB}, all S get {@code DEEP_S / BOX_S}, OL get the five line spots in personnel
 * order, etc.
 *
 * <p>Phase 4 keeps the assigner behavior position-driven and scheme-agnostic so the legacy bucket
 * aggregation in {@code RoleMatchupPassShift} continues to produce identical outputs after the
 * adapter wraps the result. Phase 5 will swap this for true scheme-fit assignment using the
 * scheme's {@link RoleDemand} table.
 */
public final class SchemeFitRoleAssigner implements RoleAssigner {

  private final OffensiveScheme offenseScheme;

  public SchemeFitRoleAssigner(OffensiveScheme offenseScheme) {
    this.offenseScheme = Objects.requireNonNull(offenseScheme, "offenseScheme");
  }

  @Override
  public RoleAssignmentPair assign(
      PlayCaller.PlayCall call, OffensivePersonnel offense, DefensivePersonnel defense) {
    Objects.requireNonNull(call, "call");
    Objects.requireNonNull(offense, "offense");
    Objects.requireNonNull(defense, "defense");

    var offenseRoles = assignOffense(offense.players());
    var defenseRoles = assignDefense(defense.players());
    return new RoleAssignmentPair(
        new OffensiveRoleAssignment(offenseRoles), new DefensiveRoleAssignment(defenseRoles));
  }

  private java.util.Map<OffensiveRole, Player> assignOffense(List<Player> players) {
    var byPosition = bucketByPosition(players);
    var assignment = new EnumMap<OffensiveRole, Player>(OffensiveRole.class);

    var qbs = byPosition.getOrDefault(Position.QB, List.of());
    if (!qbs.isEmpty()) {
      assignment.put(OffensiveRole.QB_POCKET, qbs.get(0));
    }

    var rbs = byPosition.getOrDefault(Position.RB, List.of());
    var rbRoles =
        new OffensiveRole[] {
          OffensiveRole.RB_RUSH, OffensiveRole.RB_RECEIVE, OffensiveRole.RB_PROTECT
        };
    assignByOrder(assignment, rbs, rbRoles);

    var fbs = byPosition.getOrDefault(Position.FB, List.of());
    if (!fbs.isEmpty()) {
      assignment.put(OffensiveRole.FB_LEAD, fbs.get(0));
    }

    var wrs = byPosition.getOrDefault(Position.WR, List.of());
    var wrRoles =
        new OffensiveRole[] {OffensiveRole.X_WR, OffensiveRole.Z_WR, OffensiveRole.SLOT_WR};
    assignByOrder(assignment, wrs, wrRoles);

    var tes = byPosition.getOrDefault(Position.TE, List.of());
    var teRoles =
        new OffensiveRole[] {OffensiveRole.INLINE_TE, OffensiveRole.FLEX_TE, OffensiveRole.H_BACK};
    assignByOrder(assignment, tes, teRoles);

    var ols = byPosition.getOrDefault(Position.OL, List.of());
    var olRoles =
        new OffensiveRole[] {
          OffensiveRole.LT, OffensiveRole.LG, OffensiveRole.C, OffensiveRole.RG, OffensiveRole.RT
        };
    assignByOrder(assignment, ols, olRoles);

    return assignment;
  }

  private java.util.Map<DefensiveRole, Player> assignDefense(List<Player> players) {
    var byPosition = bucketByPosition(players);
    var assignment = new EnumMap<DefensiveRole, Player>(DefensiveRole.class);

    var dls = byPosition.getOrDefault(Position.DL, List.of());
    var dlRoles =
        new DefensiveRole[] {
          DefensiveRole.NOSE, DefensiveRole.THREE_TECH, DefensiveRole.FIVE_TECH, DefensiveRole.EDGE
        };
    assignByOrder(assignment, dls, dlRoles);

    var lbs = byPosition.getOrDefault(Position.LB, List.of());
    var lbRoles =
        new DefensiveRole[] {
          DefensiveRole.MIKE_LB,
          DefensiveRole.WILL_LB,
          DefensiveRole.SAM_LB,
          DefensiveRole.STAND_UP_OLB
        };
    assignByOrder(assignment, lbs, lbRoles);

    var cbs = byPosition.getOrDefault(Position.CB, List.of());
    var cbRoles =
        new DefensiveRole[] {
          DefensiveRole.OUTSIDE_CB,
          DefensiveRole.OUTSIDE_CB,
          DefensiveRole.SLOT_CB,
          DefensiveRole.SLOT_CB
        };
    assignByOrderAllowingDuplicates(assignment, cbs, cbRoles);

    var safeties = byPosition.getOrDefault(Position.S, List.of());
    var sRoles =
        new DefensiveRole[] {
          DefensiveRole.DEEP_S, DefensiveRole.BOX_S, DefensiveRole.DIME_LB, DefensiveRole.DIME_LB
        };
    assignByOrderAllowingDuplicates(assignment, safeties, sRoles);

    return assignment;
  }

  private static java.util.Map<Position, List<Player>> bucketByPosition(List<Player> players) {
    var map = new EnumMap<Position, List<Player>>(Position.class);
    for (var p : players) {
      map.computeIfAbsent(p.position(), k -> new ArrayList<>()).add(p);
    }
    return map;
  }

  private static <R extends Enum<R>> void assignByOrder(
      java.util.Map<R, Player> assignment, List<Player> players, R[] rolesInOrder) {
    var n = Math.min(players.size(), rolesInOrder.length);
    for (var i = 0; i < n; i++) {
      assignment.putIfAbsent(rolesInOrder[i], players.get(i));
    }
  }

  private static <R extends Enum<R>> void assignByOrderAllowingDuplicates(
      java.util.Map<R, Player> assignment, List<Player> players, R[] rolesInOrder) {
    var n = Math.min(players.size(), rolesInOrder.length);
    for (var i = 0; i < n; i++) {
      var role = rolesInOrder[i];
      if (assignment.containsKey(role)) {
        continue;
      }
      assignment.put(role, players.get(i));
    }
  }
}
