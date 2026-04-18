package app.zoneblitz.gamesimulator.personnel;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DefensivePersonnelTests {

  @Test
  void construct_validBase43_returnsPersonnel() {
    var personnel = new DefensivePersonnel(DefensivePackage.BASE_43, base43Players());

    assertThat(personnel.defensiveLine()).hasSize(4);
    assertThat(personnel.linebackers()).hasSize(3);
    assertThat(personnel.cornerbacks()).hasSize(2);
    assertThat(personnel.safeties()).hasSize(2);
    assertThat(personnel.defensiveBacks()).hasSize(4);
  }

  @Test
  void construct_wrongPlayerCount_throws() {
    var players = base43Players();
    players.removeLast();

    assertThatThrownBy(() -> new DefensivePersonnel(DefensivePackage.BASE_43, players))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("exactly 11");
  }

  @Test
  void construct_mismatchDbCount_throws() {
    var players = base43Players();
    players.set(10, player(Position.LB, "extra-LB"));

    assertThatThrownBy(() -> new DefensivePersonnel(DefensivePackage.BASE_43, players))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("BASE_43");
  }

  @Test
  void construct_offensivePosition_throws() {
    var players = base43Players();
    players.set(0, player(Position.WR, "WR"));

    assertThatThrownBy(() -> new DefensivePersonnel(DefensivePackage.BASE_43, players))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("ineligible position WR");
  }

  @Test
  void construct_nickelPackage_requires5DBs() {
    var players = new ArrayList<Player>();
    for (var i = 0; i < 4; i++) {
      players.add(player(Position.DL, "DL" + i));
    }
    players.add(player(Position.LB, "LB1"));
    players.add(player(Position.LB, "LB2"));
    for (var i = 0; i < 3; i++) {
      players.add(player(Position.CB, "CB" + i));
    }
    players.add(player(Position.S, "S1"));
    players.add(player(Position.S, "S2"));

    var personnel = new DefensivePersonnel(DefensivePackage.NICKEL_425, players);

    assertThat(personnel.defensiveBacks()).hasSize(5);
  }

  private static List<Player> base43Players() {
    var players = new ArrayList<Player>();
    for (var i = 0; i < 4; i++) {
      players.add(player(Position.DL, "DL" + i));
    }
    for (var i = 0; i < 3; i++) {
      players.add(player(Position.LB, "LB" + i));
    }
    players.add(player(Position.CB, "CB1"));
    players.add(player(Position.CB, "CB2"));
    players.add(player(Position.S, "S1"));
    players.add(player(Position.S, "S2"));
    return players;
  }

  private static Player player(Position position, String name) {
    return new Player(new PlayerId(UUID.randomUUID()), position, name);
  }
}
