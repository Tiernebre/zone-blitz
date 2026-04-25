package app.zoneblitz.gamesimulator.resolver;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.personnel.DefensivePackage;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePackage;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.TestPersonnel;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import java.util.ArrayList;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RunRoleAssignerTests {

  private static final PlayCaller.PlayCall RUN_CALL = new PlayCaller.PlayCall("run");

  private final RunRoleAssigner assigner = new PositionBasedRunRoleAssigner();

  @Test
  void assign_baselinePersonnel_bucketsByPosition() {
    var offense = TestPersonnel.baselineOffense();
    var defense = TestPersonnel.baselineDefense();

    var roles = assigner.assign(RUN_CALL, offense, defense);

    assertThat(roles.ballCarrier()).isPresent();
    assertThat(roles.ballCarrier().get().position()).isEqualTo(Position.RB);
    assertThat(roles.runBlockers())
        .extracting(p -> p.position())
        .containsOnly(Position.OL, Position.TE);
    assertThat(roles.runBlockers()).hasSize(6);
    assertThat(roles.runDefenders())
        .extracting(p -> p.position())
        .containsOnly(Position.DL, Position.LB, Position.S);
    assertThat(roles.runDefenders()).hasSize(9);
  }

  @Test
  void assign_fbOnlyPersonnel_ballCarrierFallsBackToFb() {
    var fb = player(Position.FB, "FB");
    var offense = new OffensivePersonnel(OffensivePackage.P_21, p21WithFb(fb));
    var defense = TestPersonnel.baselineDefense();

    var roles = assigner.assign(RUN_CALL, offense, defense);

    assertThat(roles.ballCarrier()).isPresent();
    assertThat(roles.ballCarrier().get().position()).isEqualTo(Position.RB);
  }

  @Test
  void assign_noRbOrFbInPersonnel_fallsBackToQb() {
    var offense = new OffensivePersonnel(OffensivePackage.P_00, p00Players());
    var defense = new DefensivePersonnel(DefensivePackage.QUARTER_317, quarterPlayers());

    var roles = assigner.assign(RUN_CALL, offense, defense);

    assertThat(roles.ballCarrier()).isPresent();
    assertThat(roles.ballCarrier().get().position()).isEqualTo(Position.QB);
  }

  private static java.util.List<Player> p21WithFb(Player fb) {
    var players = new ArrayList<Player>();
    players.add(player(Position.QB, "QB"));
    players.add(player(Position.RB, "RB"));
    players.add(fb);
    players.add(player(Position.TE, "TE"));
    players.add(player(Position.WR, "WR1"));
    players.add(player(Position.WR, "WR2"));
    for (var i = 0; i < 5; i++) {
      players.add(player(Position.OL, "OL" + i));
    }
    return players;
  }

  private static java.util.List<Player> p00Players() {
    var players = new ArrayList<Player>();
    players.add(player(Position.QB, "QB"));
    for (var i = 0; i < 5; i++) {
      players.add(player(Position.WR, "WR" + i));
    }
    for (var i = 0; i < 5; i++) {
      players.add(player(Position.OL, "OL" + i));
    }
    return players;
  }

  private static java.util.List<Player> quarterPlayers() {
    var players = new ArrayList<Player>();
    for (var i = 0; i < 3; i++) {
      players.add(player(Position.DL, "DL" + i));
    }
    players.add(player(Position.LB, "LB"));
    for (var i = 0; i < 4; i++) {
      players.add(player(Position.CB, "CB" + i));
    }
    for (var i = 0; i < 3; i++) {
      players.add(player(Position.S, "S" + i));
    }
    return players;
  }

  private static Player player(Position position, String name) {
    return new Player(new PlayerId(UUID.randomUUID()), position, name);
  }
}
