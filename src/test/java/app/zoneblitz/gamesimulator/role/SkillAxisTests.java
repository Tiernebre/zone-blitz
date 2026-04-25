package app.zoneblitz.gamesimulator.role;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.roster.Skill;
import org.junit.jupiter.api.Test;

class SkillAxisTests {

  @Test
  void extract_pullsCorrectAxisFromRecord() {
    var s = new Skill(11, 22, 33, 44, 55, 66, 77, 88, 99, 10, 21, 32, 43, 54, 65);

    assertThat(SkillAxis.PASS_SET.extract(s)).isEqualTo(11);
    assertThat(SkillAxis.ROUTE_RUNNING.extract(s)).isEqualTo(22);
    assertThat(SkillAxis.COVERAGE_TECHNIQUE.extract(s)).isEqualTo(33);
    assertThat(SkillAxis.PASS_RUSH_MOVES.extract(s)).isEqualTo(44);
    assertThat(SkillAxis.BLOCK_SHEDDING.extract(s)).isEqualTo(55);
    assertThat(SkillAxis.HANDS.extract(s)).isEqualTo(66);
    assertThat(SkillAxis.RUN_BLOCK.extract(s)).isEqualTo(77);
    assertThat(SkillAxis.BALL_CARRIER_VISION.extract(s)).isEqualTo(88);
    assertThat(SkillAxis.BREAK_TACKLE.extract(s)).isEqualTo(99);
    assertThat(SkillAxis.TACKLING.extract(s)).isEqualTo(10);
    assertThat(SkillAxis.KICK_POWER.extract(s)).isEqualTo(21);
    assertThat(SkillAxis.KICK_ACCURACY.extract(s)).isEqualTo(32);
    assertThat(SkillAxis.PUNT_POWER.extract(s)).isEqualTo(43);
    assertThat(SkillAxis.PUNT_ACCURACY.extract(s)).isEqualTo(54);
    assertThat(SkillAxis.PUNT_HANG_TIME.extract(s)).isEqualTo(65);
  }

  @Test
  void values_coversEverySkillRecordField() {
    assertThat(SkillAxis.values()).hasSize(15);
  }
}
