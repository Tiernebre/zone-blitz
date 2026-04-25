package app.zoneblitz.gamesimulator.role;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.roster.Physical;
import org.junit.jupiter.api.Test;

class PhysicalAxisTests {

  @Test
  void extract_pullsCorrectAxisFromRecord() {
    var p = new Physical(81, 82, 83, 84, 85, 86, 87, 88);

    assertThat(PhysicalAxis.SPEED.extract(p)).isEqualTo(81);
    assertThat(PhysicalAxis.ACCELERATION.extract(p)).isEqualTo(82);
    assertThat(PhysicalAxis.AGILITY.extract(p)).isEqualTo(83);
    assertThat(PhysicalAxis.STRENGTH.extract(p)).isEqualTo(84);
    assertThat(PhysicalAxis.POWER.extract(p)).isEqualTo(85);
    assertThat(PhysicalAxis.BEND.extract(p)).isEqualTo(86);
    assertThat(PhysicalAxis.STAMINA.extract(p)).isEqualTo(87);
    assertThat(PhysicalAxis.EXPLOSIVENESS.extract(p)).isEqualTo(88);
  }

  @Test
  void values_coversEveryPhysicalRecordField() {
    assertThat(PhysicalAxis.values()).hasSize(8);
  }
}
