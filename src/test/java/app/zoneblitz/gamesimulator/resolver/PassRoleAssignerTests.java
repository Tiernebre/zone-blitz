package app.zoneblitz.gamesimulator.resolver;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.personnel.TestPersonnel;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.roster.Position;
import org.junit.jupiter.api.Test;

class PassRoleAssignerTests {

  private static final PlayCaller.PlayCall PASS_CALL = new PlayCaller.PlayCall("pass");

  private final PassRoleAssigner assigner = new PositionBasedPassRoleAssigner();

  @Test
  void assign_baselinePersonnel_bucketsByPosition() {
    var offense = TestPersonnel.baselineOffense();
    var defense = TestPersonnel.baselineDefense();

    var roles = assigner.assign(PASS_CALL, offense, defense);

    assertThat(roles.routeRunners())
        .extracting(p -> p.position())
        .containsOnly(Position.WR, Position.TE, Position.RB);
    assertThat(roles.routeRunners()).hasSize(5);
    assertThat(roles.passBlockers()).extracting(p -> p.position()).containsOnly(Position.OL);
    assertThat(roles.passBlockers()).hasSize(5);
    assertThat(roles.passRushers())
        .extracting(p -> p.position())
        .containsOnly(Position.DL, Position.LB);
    assertThat(roles.passRushers()).hasSize(7);
    assertThat(roles.coverageDefenders())
        .extracting(p -> p.position())
        .containsOnly(Position.CB, Position.S);
    assertThat(roles.coverageDefenders()).hasSize(4);
  }

  @Test
  void assign_qbExcludedFromAllBuckets() {
    var offense = TestPersonnel.baselineOffense();
    var defense = TestPersonnel.baselineDefense();

    var roles = assigner.assign(PASS_CALL, offense, defense);

    assertThat(roles.routeRunners()).noneMatch(p -> p.position() == Position.QB);
    assertThat(roles.passBlockers()).noneMatch(p -> p.position() == Position.QB);
  }
}
