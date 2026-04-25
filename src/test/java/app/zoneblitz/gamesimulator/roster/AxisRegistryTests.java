package app.zoneblitz.gamesimulator.roster;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.gamesimulator.role.PhysicalAxis;
import app.zoneblitz.gamesimulator.role.SkillAxis;
import app.zoneblitz.gamesimulator.role.TendencyAxis;
import org.junit.jupiter.api.Test;

class AxisRegistryTests {

  @Test
  void axesInOrder_orderedAsPhysicalSkillTendency() {
    var axes = AxisRegistry.AXES_IN_ORDER;

    assertThat(axes).hasSize(31);
    assertThat(axes.subList(0, 8)).containsExactly(PhysicalAxis.values());
    assertThat(axes.subList(8, 23)).containsExactly(SkillAxis.values());
    assertThat(axes.subList(23, 31)).containsExactly(TendencyAxis.values());
  }

  @Test
  void byJsonName_mapsCamelCaseToTypedAxis() {
    assertThat(AxisRegistry.byJsonName("speed")).isEqualTo(PhysicalAxis.SPEED);
    assertThat(AxisRegistry.byJsonName("acceleration")).isEqualTo(PhysicalAxis.ACCELERATION);
    assertThat(AxisRegistry.byJsonName("passSet")).isEqualTo(SkillAxis.PASS_SET);
    assertThat(AxisRegistry.byJsonName("kickPower")).isEqualTo(SkillAxis.KICK_POWER);
    assertThat(AxisRegistry.byJsonName("puntHangTime")).isEqualTo(SkillAxis.PUNT_HANG_TIME);
    assertThat(AxisRegistry.byJsonName("footballIq")).isEqualTo(TendencyAxis.FOOTBALL_IQ);
    assertThat(AxisRegistry.byJsonName("ballCarrierVision"))
        .isEqualTo(SkillAxis.BALL_CARRIER_VISION);
  }

  @Test
  void byJsonName_throwsOnUnknownAxis() {
    assertThatThrownBy(() -> AxisRegistry.byJsonName("notAnAxis"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unknown");
  }

  @Test
  void indexOf_returnsConsistentIndex() {
    assertThat(AxisRegistry.indexOf(PhysicalAxis.SPEED)).isEqualTo(0);
    assertThat(AxisRegistry.indexOf(SkillAxis.PASS_SET)).isEqualTo(8);
    assertThat(AxisRegistry.indexOf(TendencyAxis.COMPOSURE)).isEqualTo(23);
  }
}
