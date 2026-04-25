package app.zoneblitz.gamesimulator.role;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.roster.Position;
import org.junit.jupiter.api.Test;

class RoleTests {

  @Test
  void offensiveRole_codeMatchesEnumName() {
    assertThat(OffensiveRole.X_WR.code()).isEqualTo("X_WR");
    assertThat(OffensiveRole.QB_POCKET.code()).isEqualTo("QB_POCKET");
  }

  @Test
  void defensiveRole_codeMatchesEnumName() {
    assertThat(DefensiveRole.BOX_S.code()).isEqualTo("BOX_S");
    assertThat(DefensiveRole.NOSE.code()).isEqualTo("NOSE");
  }

  @Test
  void offensiveRole_basePositionGroupsByEligibility() {
    assertThat(OffensiveRole.X_WR.basePosition()).isEqualTo(Position.WR);
    assertThat(OffensiveRole.SLOT_WR.basePosition()).isEqualTo(Position.WR);
    assertThat(OffensiveRole.QB_POCKET.basePosition()).isEqualTo(Position.QB);
    assertThat(OffensiveRole.QB_MOVEMENT.basePosition()).isEqualTo(Position.QB);
    assertThat(OffensiveRole.LT.basePosition()).isEqualTo(Position.OL);
    assertThat(OffensiveRole.C.basePosition()).isEqualTo(Position.OL);
  }

  @Test
  void defensiveRole_basePositionGroupsByEligibility() {
    assertThat(DefensiveRole.BOX_S.basePosition()).isEqualTo(Position.S);
    assertThat(DefensiveRole.DEEP_S.basePosition()).isEqualTo(Position.S);
    assertThat(DefensiveRole.OUTSIDE_CB.basePosition()).isEqualTo(Position.CB);
    assertThat(DefensiveRole.SLOT_CB.basePosition()).isEqualTo(Position.CB);
    assertThat(DefensiveRole.NOSE.basePosition()).isEqualTo(Position.DL);
    assertThat(DefensiveRole.MIKE_LB.basePosition()).isEqualTo(Position.LB);
  }

  @Test
  void dimeLb_isSafetyEligibleByDesign() {
    assertThat(DefensiveRole.DIME_LB.basePosition()).isEqualTo(Position.S);
  }

  @Test
  void sealedHierarchy_partitionsCleanly() {
    Role offensive = OffensiveRole.X_WR;
    Role defensive = DefensiveRole.OUTSIDE_CB;

    assertThat(offensive).isInstanceOf(OffensiveRole.class).isNotInstanceOf(DefensiveRole.class);
    assertThat(defensive).isInstanceOf(DefensiveRole.class).isNotInstanceOf(OffensiveRole.class);
  }
}
