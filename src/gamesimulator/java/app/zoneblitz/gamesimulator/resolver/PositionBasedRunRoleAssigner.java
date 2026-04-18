package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Default {@link RunRoleAssigner}: buckets players by position for run plays.
 *
 * <ul>
 *   <li>Ball carrier: first RB in personnel order; falls back to FB, then QB. Empty if personnel
 *       carries no rushing-eligible player.
 *   <li>OL, FB, TE → run blockers (the FB also appears here even when designated as the carrier on
 *       a dive; multi-role personnel is a later refinement).
 *   <li>DL, LB, S → run defenders (safeties are in the box on most run fits).
 * </ul>
 *
 * <p>WRs, CBs, and QBs are dropped — they rarely contribute to the clamped run matchup. When
 * attribute-aware grouping lands, press-man corners will re-enter the defender bucket on outside
 * runs.
 */
public final class PositionBasedRunRoleAssigner implements RunRoleAssigner {

  @Override
  public RunRoles assign(
      PlayCaller.PlayCall call, OffensivePersonnel offense, DefensivePersonnel defense) {
    var runBlockers = new ArrayList<Player>();
    for (var p : offense.players()) {
      switch (p.position()) {
        case OL, FB, TE -> runBlockers.add(p);
        default -> {}
      }
    }

    var runDefenders = new ArrayList<Player>();
    for (var p : defense.players()) {
      switch (p.position()) {
        case DL, LB, S -> runDefenders.add(p);
        default -> {}
      }
    }

    return new RunRoles(pickCarrier(offense.players()), runBlockers, runDefenders);
  }

  private static Optional<Player> pickCarrier(List<Player> offense) {
    for (var pos : new Position[] {Position.RB, Position.FB, Position.QB}) {
      for (var p : offense) {
        if (p.position() == pos) {
          return Optional.of(p);
        }
      }
    }
    return Optional.empty();
  }
}
