package app.zoneblitz.gamesimulator.personnel;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Baseline {@link PersonnelSelector}: always returns {@link OffensivePackage#P_11} for offense and
 * {@link DefensivePackage#BASE_43} for defense, picking the first roster-order players that fit
 * each position quota. Throws if the supplied team doesn't carry enough players of some required
 * position — realistic rosters will; fixture rosters that want different packages should use a
 * dedicated selector.
 *
 * <p>Situational package selection (nickel on third-and-long, goal line on the 1) is out of scope
 * for this implementation; future selectors will honor {@link GameState} and {@link
 * PlayCaller.PlayCall}.
 */
public final class BaselinePersonnelSelector implements PersonnelSelector {

  @Override
  public OffensivePersonnel selectOffense(PlayCaller.PlayCall call, GameState state, Team offense) {
    Objects.requireNonNull(call, "call");
    Objects.requireNonNull(state, "state");
    Objects.requireNonNull(offense, "offense");
    var pkg = OffensivePackage.P_11;
    var players = new ArrayList<Player>(11);
    addFirstN(offense.roster(), Position.QB, pkg.quarterbacks(), players);
    addRunningBacks(offense.roster(), pkg.rbs(), players);
    addFirstN(offense.roster(), Position.TE, pkg.tes(), players);
    addFirstN(offense.roster(), Position.WR, pkg.wrs(), players);
    addFirstN(offense.roster(), Position.OL, pkg.offensiveLinemen(), players);
    return new OffensivePersonnel(pkg, players);
  }

  @Override
  public DefensivePersonnel selectDefense(
      PlayCaller.PlayCall call, OffensivePersonnel offense, GameState state, Team defense) {
    Objects.requireNonNull(call, "call");
    Objects.requireNonNull(offense, "offense");
    Objects.requireNonNull(state, "state");
    Objects.requireNonNull(defense, "defense");
    var pkg = DefensivePackage.BASE_43;
    var players = new ArrayList<Player>(11);
    addFirstN(defense.roster(), Position.DL, pkg.defensiveLinemen(), players);
    addFirstN(defense.roster(), Position.LB, pkg.linebackers(), players);
    addDefensiveBacks(defense.roster(), pkg.defensiveBacks(), players);
    return new DefensivePersonnel(pkg, players);
  }

  private static void addFirstN(
      List<Player> roster, Position position, int count, List<Player> out) {
    var picked = 0;
    for (var p : roster) {
      if (picked == count) {
        return;
      }
      if (p.position() == position) {
        out.add(p);
        picked++;
      }
    }
    if (picked < count) {
      throw new IllegalStateException(
          "Roster has only %d %s; needed %d".formatted(picked, position, count));
    }
  }

  private static void addRunningBacks(List<Player> roster, int count, List<Player> out) {
    var picked = 0;
    for (var p : roster) {
      if (picked == count) {
        return;
      }
      if (p.position() == Position.RB || p.position() == Position.FB) {
        out.add(p);
        picked++;
      }
    }
    if (picked < count) {
      throw new IllegalStateException(
          "Roster has only %d RB/FB; needed %d".formatted(picked, count));
    }
  }

  private static void addDefensiveBacks(List<Player> roster, int count, List<Player> out) {
    var picked = 0;
    for (var p : roster) {
      if (picked == count) {
        return;
      }
      if (p.position() == Position.CB || p.position() == Position.S) {
        out.add(p);
        picked++;
      }
    }
    if (picked < count) {
      throw new IllegalStateException("Roster has only %d DB; needed %d".formatted(picked, count));
    }
  }
}
