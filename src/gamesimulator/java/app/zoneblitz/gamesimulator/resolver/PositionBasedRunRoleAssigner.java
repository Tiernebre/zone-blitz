package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.ArrayList;
import java.util.Optional;

/**
 * Default {@link RunRoleAssigner}: buckets players by position for run plays.
 *
 * <ul>
 *   <li>Ball carrier: first RB on the roster; falls back to FB, then QB. Empty if the offense has
 *       no rushing-eligible player on the field.
 *   <li>OL, FB, TE → run blockers (the FB also appears here even when designated as the carrier on
 *       a dive; multi-role personnel is a later refinement).
 *   <li>DL, LB, S → run defenders (safeties are in the box on most run fits).
 * </ul>
 *
 * <p>WRs, CBs, QBs, and specialists are dropped — they rarely contribute to the clamped run
 * matchup. When attribute-aware personnel grouping lands, press-man corners will re-enter the
 * defender bucket on outside runs.
 */
public final class PositionBasedRunRoleAssigner implements RunRoleAssigner {

  @Override
  public RunRoles assign(PlayCaller.PlayCall call, Team offense, Team defense) {
    var runBlockers = new ArrayList<Player>();
    for (var p : offense.roster()) {
      switch (p.position()) {
        case OL, FB, TE -> runBlockers.add(p);
        default -> {}
      }
    }

    var runDefenders = new ArrayList<Player>();
    for (var p : defense.roster()) {
      switch (p.position()) {
        case DL, LB, S -> runDefenders.add(p);
        default -> {}
      }
    }

    return new RunRoles(pickCarrier(offense), runBlockers, runDefenders);
  }

  private static Optional<Player> pickCarrier(Team offense) {
    for (var pos : new Position[] {Position.RB, Position.FB, Position.QB}) {
      for (var p : offense.roster()) {
        if (p.position() == pos) {
          return Optional.of(p);
        }
      }
    }
    return Optional.empty();
  }
}
