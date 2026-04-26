package app.zoneblitz.gamesimulator.role;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.roster.Tendencies;
import org.junit.jupiter.api.Test;

class TendencyAxisTests {

  @Test
  void extract_pullsCorrectAxisFromRecord() {
    var t = new Tendencies(11, 22, 33, 44, 55, 66, 77, 88, 99);

    assertThat(TendencyAxis.COMPOSURE.extract(t)).isEqualTo(11);
    assertThat(TendencyAxis.DISCIPLINE.extract(t)).isEqualTo(22);
    assertThat(TendencyAxis.FOOTBALL_IQ.extract(t)).isEqualTo(33);
    assertThat(TendencyAxis.PROCESSING.extract(t)).isEqualTo(44);
    assertThat(TendencyAxis.TOUGHNESS.extract(t)).isEqualTo(55);
    assertThat(TendencyAxis.CLUTCH.extract(t)).isEqualTo(66);
    assertThat(TendencyAxis.CONSISTENCY.extract(t)).isEqualTo(77);
    assertThat(TendencyAxis.MOTOR.extract(t)).isEqualTo(88);
    assertThat(TendencyAxis.PLAY_RECOGNITION.extract(t)).isEqualTo(99);
  }

  @Test
  void values_coversEveryTendenciesRecordField() {
    assertThat(TendencyAxis.values()).hasSize(9);
  }
}
