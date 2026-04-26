package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.role.DefensiveRole;
import app.zoneblitz.gamesimulator.role.OffensiveRole;
import app.zoneblitz.gamesimulator.role.RoleAssignmentPair;
import app.zoneblitz.gamesimulator.roster.Player;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Per-snap role buckets for run-play matchup aggregates.
 *
 * <p>Mirrors {@link PassRoles} on the run side: a designated ball carrier plus three role buckets
 * feeding the clamped physical/skill matchup. Run defense is intentionally one aggregate —
 * block-shedding at the line of scrimmage and second-level tackling share players on nearly every
 * snap, so splitting them by player is artificial. The aggregate skill axis blends both.
 *
 * <p>Role is assigned by the offensive play call, not the depth chart: a lead-blocking TE lands in
 * {@link #runBlockers} rather than continuing to play its pass-role, and a nickel corner filling a
 * gap lands in {@link #runDefenders}.
 *
 * <p>Construction comes from a {@link RoleAssignmentPair} via {@link #from(RoleAssignmentPair)} —
 * carrier precedence is RB_RUSH &gt; FB_LEAD &gt; QB_POCKET, blockers are OL/FB/TE roles minus the
 * carrier, defenders are the front seven plus box safeties.
 *
 * <p>Phase 10.5 follow-up: deletable once {@code MatchupRunResolver.resolve} consumes {@link
 * RoleAssignmentPair} directly for carrier extraction. Mechanical refactor with no architectural
 * blocker.
 *
 * @param ballCarrier the player receiving the handoff (or keeping it on a QB run); empty only if
 *     the offense has no rushing-eligible player on the field
 * @param runBlockers blockers engaged at and beyond the line of scrimmage (OL, FB, lead TE)
 * @param runDefenders front-seven and box defenders tasked with defeating blocks and making the
 *     tackle
 */
public record RunRoles(
    Optional<Player> ballCarrier, List<Player> runBlockers, List<Player> runDefenders) {

  public RunRoles {
    Objects.requireNonNull(ballCarrier, "ballCarrier");
    Objects.requireNonNull(runBlockers, "runBlockers");
    Objects.requireNonNull(runDefenders, "runDefenders");
    runBlockers = List.copyOf(runBlockers);
    runDefenders = List.copyOf(runDefenders);
  }

  public static RunRoles from(RoleAssignmentPair pair) {
    Objects.requireNonNull(pair, "pair");
    var carrier = pickCarrier(pair);
    var blockers = new ArrayList<Player>();
    pair.offense()
        .players()
        .forEach(
            (role, player) -> {
              if (isRunBlocker(role) && !player.equals(carrier.orElse(null))) {
                blockers.add(player);
              }
            });

    var defenders = new ArrayList<Player>();
    pair.defense()
        .players()
        .forEach(
            (role, player) -> {
              if (isRunDefender(role)) {
                defenders.add(player);
              }
            });

    return new RunRoles(carrier, blockers, defenders);
  }

  private static Optional<Player> pickCarrier(RoleAssignmentPair pair) {
    var off = pair.offense().players();
    var rb = off.get(OffensiveRole.RB_RUSH);
    if (rb != null) return Optional.of(rb);
    var fb = off.get(OffensiveRole.FB_LEAD);
    if (fb != null) return Optional.of(fb);
    var qb = off.get(OffensiveRole.QB_POCKET);
    if (qb != null) return Optional.of(qb);
    return Optional.empty();
  }

  public static boolean isRunBlocker(OffensiveRole role) {
    return switch (role) {
      case LT, LG, C, RG, RT, FB_LEAD, INLINE_TE, FLEX_TE, H_BACK -> true;
      default -> false;
    };
  }

  public static boolean isRunDefender(DefensiveRole role) {
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
