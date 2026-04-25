package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.roster.Player;
import java.util.ArrayList;
import java.util.List;

/**
 * Default {@link PassRoleAssigner}: buckets players by position for pass plays.
 *
 * <ul>
 *   <li>OL, FB → pass blockers.
 *   <li>WR, TE, RB → route runners (RB acts as a checkdown outlet until max-protect logic lands).
 *   <li>DL, LB → pass rushers.
 *   <li>CB, S → coverage defenders.
 * </ul>
 *
 * <p>QBs are dropped — the QB holds the ball; specialists never appear in scrimmage personnel at
 * all.
 */
public final class PositionBasedPassRoleAssigner implements PassRoleAssigner {

  @Override
  public PassRoles assign(
      PlayCaller.PlayCall call, OffensivePersonnel offense, DefensivePersonnel defense) {
    var passBlockers = new ArrayList<Player>();
    var routeRunners = new ArrayList<Player>();
    for (var p : offense.players()) {
      switch (p.position()) {
        case OL, FB -> passBlockers.add(p);
        case WR, TE, RB -> routeRunners.add(p);
        default -> {}
      }
    }

    var passRushers = new ArrayList<Player>();
    var coverageDefenders = new ArrayList<Player>();
    for (var p : defense.players()) {
      switch (p.position()) {
        case DL, LB -> passRushers.add(p);
        case CB, S -> coverageDefenders.add(p);
        default -> {}
      }
    }

    return new PassRoles(
        List.copyOf(passRushers),
        List.copyOf(passBlockers),
        List.copyOf(routeRunners),
        List.copyOf(coverageDefenders));
  }
}
