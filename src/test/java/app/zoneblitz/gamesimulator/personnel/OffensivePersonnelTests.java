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

class OffensivePersonnelTests {

  @Test
  void construct_validP11_returnsPersonnel() {
    var personnel = new OffensivePersonnel(OffensivePackage.P_11, p11Players());

    assertThat(personnel.quarterback().position()).isEqualTo(Position.QB);
    assertThat(personnel.receivers()).hasSize(3);
    assertThat(personnel.tightEnds()).hasSize(1);
    assertThat(personnel.runningBacks()).hasSize(1);
    assertThat(personnel.offensiveLine()).hasSize(5);
  }

  @Test
  void construct_wrongPlayerCount_throws() {
    var players = p11Players();
    players.removeLast();

    assertThatThrownBy(() -> new OffensivePersonnel(OffensivePackage.P_11, players))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("exactly 11");
  }

  @Test
  void construct_mismatchPositionCount_throws() {
    var players = p11Players();
    players.set(1, player(Position.TE, "extra-TE"));

    assertThatThrownBy(() -> new OffensivePersonnel(OffensivePackage.P_11, players))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("P_11");
  }

  @Test
  void construct_ineligiblePosition_throws() {
    var players = p11Players();
    players.set(10, player(Position.K, "Kicker"));

    assertThatThrownBy(() -> new OffensivePersonnel(OffensivePackage.P_11, players))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("ineligible position K");
  }

  @Test
  void construct_fbCountsAsRunningBack() {
    var players = p11Players();
    players.set(1, player(Position.FB, "FB"));

    var personnel = new OffensivePersonnel(OffensivePackage.P_11, players);

    assertThat(personnel.runningBacks()).hasSize(1);
    assertThat(personnel.runningBacks().get(0).position()).isEqualTo(Position.FB);
  }

  @Test
  void construct_jumboPackage_requires6OL() {
    var players = new ArrayList<Player>();
    players.add(player(Position.QB, "QB"));
    players.add(player(Position.RB, "RB1"));
    players.add(player(Position.RB, "RB2"));
    players.add(player(Position.TE, "TE1"));
    players.add(player(Position.TE, "TE2"));
    for (var i = 0; i < 6; i++) {
      players.add(player(Position.OL, "OL" + i));
    }

    var personnel = new OffensivePersonnel(OffensivePackage.JUMBO_6OL_22, players);

    assertThat(personnel.offensiveLine()).hasSize(6);
    assertThat(personnel.runningBacks()).hasSize(2);
    assertThat(personnel.tightEnds()).hasSize(2);
  }

  private static List<Player> p11Players() {
    var players = new ArrayList<Player>();
    players.add(player(Position.QB, "QB"));
    players.add(player(Position.RB, "RB"));
    players.add(player(Position.TE, "TE"));
    players.add(player(Position.WR, "WR1"));
    players.add(player(Position.WR, "WR2"));
    players.add(player(Position.WR, "WR3"));
    for (var i = 0; i < 5; i++) {
      players.add(player(Position.OL, "OL" + i));
    }
    return players;
  }

  private static Player player(Position position, String name) {
    return new Player(new PlayerId(UUID.randomUUID()), position, name);
  }
}
