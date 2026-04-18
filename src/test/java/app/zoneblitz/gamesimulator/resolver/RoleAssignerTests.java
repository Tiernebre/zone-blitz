package app.zoneblitz.gamesimulator.resolver;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RoleAssignerTests {

  private static final PlayCaller.PlayCall PASS_CALL = new PlayCaller.PlayCall("pass");

  private final RoleAssigner assigner = new PositionBasedRoleAssigner();

  @Test
  void assign_mixedRoster_bucketsByPosition() {
    var qb = player(1, Position.QB, "QB");
    var wr1 = player(2, Position.WR, "WR1");
    var wr2 = player(3, Position.WR, "WR2");
    var te = player(4, Position.TE, "TE");
    var rb = player(5, Position.RB, "RB");
    var fb = player(6, Position.FB, "FB");
    var ol1 = player(7, Position.OL, "LT");
    var ol2 = player(8, Position.OL, "RG");
    var k = player(9, Position.K, "K");
    var offense =
        new Team(
            new TeamId(new UUID(1L, 0L)),
            "Offense",
            List.of(qb, wr1, wr2, te, rb, fb, ol1, ol2, k));

    var dl1 = player(11, Position.DL, "DE");
    var dl2 = player(12, Position.DL, "DT");
    var lb = player(13, Position.LB, "MLB");
    var cb1 = player(14, Position.CB, "CB1");
    var cb2 = player(15, Position.CB, "CB2");
    var s = player(16, Position.S, "FS");
    var p = player(17, Position.P, "P");
    var defense =
        new Team(new TeamId(new UUID(2L, 0L)), "Defense", List.of(dl1, dl2, lb, cb1, cb2, s, p));

    var roles = assigner.assign(PASS_CALL, offense, defense);

    assertThat(roles.routeRunners()).containsExactly(wr1, wr2, te, rb);
    assertThat(roles.passBlockers()).containsExactly(fb, ol1, ol2);
    assertThat(roles.passRushers()).containsExactly(dl1, dl2, lb);
    assertThat(roles.coverageDefenders()).containsExactly(cb1, cb2, s);
  }

  @Test
  void assign_rosterWithOnlySpecialists_returnsEmptyBuckets() {
    var offense =
        new Team(
            new TeamId(new UUID(1L, 0L)),
            "Specialists",
            List.of(player(1, Position.K, "K"), player(2, Position.LS, "LS")));
    var defense =
        new Team(new TeamId(new UUID(2L, 0L)), "Empty", List.of(player(3, Position.P, "P")));

    var roles = assigner.assign(PASS_CALL, offense, defense);

    assertThat(roles.passBlockers()).isEmpty();
    assertThat(roles.routeRunners()).isEmpty();
    assertThat(roles.passRushers()).isEmpty();
    assertThat(roles.coverageDefenders()).isEmpty();
  }

  private static Player player(int seed, Position position, String name) {
    return new Player(new PlayerId(new UUID(0L, seed)), position, name);
  }
}
