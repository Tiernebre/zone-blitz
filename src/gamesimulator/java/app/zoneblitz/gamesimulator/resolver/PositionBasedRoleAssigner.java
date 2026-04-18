package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.ArrayList;
import java.util.List;

/**
 * Default {@link RoleAssigner}: buckets players by position for pass plays.
 *
 * <ul>
 *   <li>OL, FB → pass blockers.
 *   <li>WR, TE, RB → route runners (RB acts as a checkdown outlet until max-protect logic lands).
 *   <li>DL, LB → pass rushers.
 *   <li>CB, S → coverage defenders.
 * </ul>
 *
 * <p>QBs and specialists (K, P, LS) are dropped from the buckets — the QB holds the ball, and
 * specialists never appear on scrimmage snaps.
 */
public final class PositionBasedRoleAssigner implements RoleAssigner {

  @Override
  public Roles assign(PlayCaller.PlayCall call, Team offense, Team defense) {
    var passBlockers = new ArrayList<Player>();
    var routeRunners = new ArrayList<Player>();
    for (var p : offense.roster()) {
      switch (p.position()) {
        case OL, FB -> passBlockers.add(p);
        case WR, TE, RB -> routeRunners.add(p);
        default -> {}
      }
    }

    var passRushers = new ArrayList<Player>();
    var coverageDefenders = new ArrayList<Player>();
    for (var p : defense.roster()) {
      switch (p.position()) {
        case DL, LB -> passRushers.add(p);
        case CB, S -> coverageDefenders.add(p);
        default -> {}
      }
    }

    return new Roles(
        List.copyOf(passRushers),
        List.copyOf(passBlockers),
        List.copyOf(routeRunners),
        List.copyOf(coverageDefenders));
  }
}
