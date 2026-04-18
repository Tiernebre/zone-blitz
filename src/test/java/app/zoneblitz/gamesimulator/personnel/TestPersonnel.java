package app.zoneblitz.gamesimulator.personnel;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/**
 * Test helper: builds valid {@link OffensivePersonnel} / {@link DefensivePersonnel} with stub
 * average-attribute players. Callers supply override players to swap specific spots (e.g. an elite
 * WR in a 1-WR test); the remaining slots are filled with generated stubs so the record's
 * validation passes.
 */
public final class TestPersonnel {

  private TestPersonnel() {}

  /** 11 offensive players in {@link OffensivePackage#P_11}: 1 QB, 1 RB, 1 TE, 3 WR, 5 OL. */
  public static OffensivePersonnel baselineOffense() {
    return new OffensivePersonnel(OffensivePackage.P_11, buildP11Players(List.of()));
  }

  /**
   * 11 offensive players in {@link OffensivePackage#P_11} with the supplied override players
   * inserted into their position slots; remaining slots are filled with stub players.
   */
  public static OffensivePersonnel offenseWith(Player... overrides) {
    return new OffensivePersonnel(OffensivePackage.P_11, buildP11Players(Arrays.asList(overrides)));
  }

  /** 11 defensive players in {@link DefensivePackage#BASE_43}: 4 DL, 3 LB, 2 CB, 2 S. */
  public static DefensivePersonnel baselineDefense() {
    return new DefensivePersonnel(DefensivePackage.BASE_43, buildBase43Players(List.of()));
  }

  /**
   * 11 defensive players in {@link DefensivePackage#BASE_43} with the supplied override players
   * inserted into their position slots; remaining slots are filled with stub players.
   */
  public static DefensivePersonnel defenseWith(Player... overrides) {
    return new DefensivePersonnel(
        DefensivePackage.BASE_43, buildBase43Players(Arrays.asList(overrides)));
  }

  private static List<Player> buildP11Players(List<Player> overrides) {
    var players = new ArrayList<Player>(11);
    addFilling(players, Position.QB, 1, overrides, "off-qb");
    addFilling(players, Position.WR, 3, overrides, "off-wr");
    addFilling(players, Position.TE, 1, overrides, "off-te");
    addFilling(players, Position.RB, 1, overrides, "off-rb");
    addFilling(players, Position.OL, 5, overrides, "off-ol");
    return players;
  }

  private static List<Player> buildBase43Players(List<Player> overrides) {
    var players = new ArrayList<Player>(11);
    addFilling(players, Position.DL, 4, overrides, "def-dl");
    addFilling(players, Position.LB, 3, overrides, "def-lb");
    addFilling(players, Position.CB, 2, overrides, "def-cb");
    addFilling(players, Position.S, 2, overrides, "def-s");
    return players;
  }

  private static void addFilling(
      List<Player> out, Position position, int needed, List<Player> overrides, String stubPrefix) {
    var added = 0;
    for (var p : overrides) {
      if (added == needed) {
        break;
      }
      if (p.position() == position) {
        out.add(p);
        added++;
      }
    }
    while (added < needed) {
      out.add(stub(position, stubPrefix + "-" + added));
      added++;
    }
  }

  private static Player stub(Position position, String name) {
    return new Player(new PlayerId(UUID.randomUUID()), position, name);
  }
}
