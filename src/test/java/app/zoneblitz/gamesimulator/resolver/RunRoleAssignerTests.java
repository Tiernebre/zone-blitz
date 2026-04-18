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

class RunRoleAssignerTests {

  private static final PlayCaller.PlayCall RUN_CALL = new PlayCaller.PlayCall("run");

  private final RunRoleAssigner assigner = new PositionBasedRunRoleAssigner();

  @Test
  void assign_mixedRoster_bucketsByPosition() {
    var qb = player(1, Position.QB, "QB");
    var wr = player(2, Position.WR, "WR1");
    var te = player(4, Position.TE, "TE");
    var rb = player(5, Position.RB, "RB");
    var fb = player(6, Position.FB, "FB");
    var ol1 = player(7, Position.OL, "LT");
    var ol2 = player(8, Position.OL, "RG");
    var offense =
        new Team(new TeamId(new UUID(1L, 0L)), "Offense", List.of(qb, wr, te, rb, fb, ol1, ol2));

    var dl = player(11, Position.DL, "DE");
    var lb = player(13, Position.LB, "MLB");
    var cb = player(14, Position.CB, "CB");
    var s = player(16, Position.S, "FS");
    var defense = new Team(new TeamId(new UUID(2L, 0L)), "Defense", List.of(dl, lb, cb, s));

    var roles = assigner.assign(RUN_CALL, offense, defense);

    assertThat(roles.ballCarrier()).contains(rb);
    assertThat(roles.runBlockers()).containsExactly(te, fb, ol1, ol2);
    assertThat(roles.runDefenders()).containsExactly(dl, lb, s);
  }

  @Test
  void assign_noRB_fallsBackToFB() {
    var fb = player(1, Position.FB, "FB");
    var offense =
        new Team(new TeamId(new UUID(1L, 0L)), "FB-only", List.of(fb, player(2, Position.OL, "C")));
    var defense =
        new Team(new TeamId(new UUID(2L, 0L)), "D", List.of(player(3, Position.LB, "LB")));

    var roles = assigner.assign(RUN_CALL, offense, defense);

    assertThat(roles.ballCarrier()).contains(fb);
  }

  @Test
  void assign_noRushEligiblePlayer_returnsEmptyCarrier() {
    var offense =
        new Team(new TeamId(new UUID(1L, 0L)), "WRs-only", List.of(player(1, Position.WR, "WR")));
    var defense =
        new Team(new TeamId(new UUID(2L, 0L)), "D", List.of(player(2, Position.CB, "CB")));

    var roles = assigner.assign(RUN_CALL, offense, defense);

    assertThat(roles.ballCarrier()).isEmpty();
  }

  private static Player player(int seed, Position position, String name) {
    return new Player(new PlayerId(new UUID(0L, seed)), position, name);
  }
}
