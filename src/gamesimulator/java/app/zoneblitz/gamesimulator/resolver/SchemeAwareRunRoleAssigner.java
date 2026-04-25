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
import java.util.Optional;

/**
 * Bridge between the new fine-grained {@link RoleAssigner} and the legacy {@link RunRoles}
 * aggregate that {@code RoleMatchupRunShift} consumes. Carrier is the assigned RB_RUSH (or FB_LEAD
 * or QB if no RB on the field); blockers are the OL + FB + TE roles; defenders are the front seven
 * plus box safeties.
 */
public final class SchemeAwareRunRoleAssigner implements RunRoleAssigner {

  private final RoleAssigner delegate;

  public SchemeAwareRunRoleAssigner(RoleAssigner delegate) {
    this.delegate = Objects.requireNonNull(delegate, "delegate");
  }

  @Override
  public RunRoles assign(
      PlayCaller.PlayCall call, OffensivePersonnel offense, DefensivePersonnel defense) {
    var pair = delegate.assign(call, offense, defense);

    var carrier = pickCarrier(pair);
    var runBlockers = new ArrayList<Player>();
    pair.offense()
        .players()
        .forEach(
            (role, player) -> {
              if (isRunBlocker(role) && !player.equals(carrier.orElse(null))) {
                runBlockers.add(player);
              }
            });

    var runDefenders = new ArrayList<Player>();
    pair.defense()
        .players()
        .forEach(
            (role, player) -> {
              if (isRunDefender(role)) {
                runDefenders.add(player);
              }
            });

    return new RunRoles(carrier, List.copyOf(runBlockers), List.copyOf(runDefenders));
  }

  private static Optional<Player> pickCarrier(
      app.zoneblitz.gamesimulator.role.RoleAssignmentPair pair) {
    var off = pair.offense().players();
    var rb = off.get(OffensiveRole.RB_RUSH);
    if (rb != null) return Optional.of(rb);
    var fb = off.get(OffensiveRole.FB_LEAD);
    if (fb != null) return Optional.of(fb);
    var qb = off.get(OffensiveRole.QB_POCKET);
    if (qb != null) return Optional.of(qb);
    return Optional.empty();
  }

  private static boolean isRunBlocker(OffensiveRole role) {
    return switch (role) {
      case LT, LG, C, RG, RT, FB_LEAD, INLINE_TE, FLEX_TE, H_BACK -> true;
      default -> false;
    };
  }

  private static boolean isRunDefender(DefensiveRole role) {
    return switch (role) {
      case NOSE,
          THREE_TECH,
          FIVE_TECH,
          EDGE,
          STAND_UP_OLB,
          MIKE_LB,
          WILL_LB,
          SAM_LB,
          BOX_S,
          DIME_LB ->
          true;
      default -> false;
    };
  }
}
