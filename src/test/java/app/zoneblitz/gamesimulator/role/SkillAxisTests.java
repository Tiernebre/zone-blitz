package app.zoneblitz.gamesimulator.role;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.roster.Skill;
import org.junit.jupiter.api.Test;

class SkillAxisTests {

  @Test
  void extract_pullsCorrectAxisFromRecord() {
    var s =
        new Skill(
            11, 22, 33, 44, 55, 66, 77, 88, 99, 10, 21, 32, 43, 54, 65, 12, 23, 34, 45, 56, 67, 78,
            89, 13, 24, 35, 46, 57, 68);

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
    assertThat(SkillAxis.ARM_STRENGTH.extract(s)).isEqualTo(12);
    assertThat(SkillAxis.SHORT_ACCURACY.extract(s)).isEqualTo(23);
    assertThat(SkillAxis.DEEP_ACCURACY.extract(s)).isEqualTo(34);
    assertThat(SkillAxis.POCKET_PRESENCE.extract(s)).isEqualTo(45);
    assertThat(SkillAxis.PLAY_ACTION.extract(s)).isEqualTo(56);
    assertThat(SkillAxis.MOBILITY.extract(s)).isEqualTo(67);
    assertThat(SkillAxis.CARRYING.extract(s)).isEqualTo(78);
    assertThat(SkillAxis.CATCHING.extract(s)).isEqualTo(89);
    assertThat(SkillAxis.PASS_PROTECTION.extract(s)).isEqualTo(13);
    assertThat(SkillAxis.RELEASE.extract(s)).isEqualTo(24);
    assertThat(SkillAxis.CONTESTED_CATCH.extract(s)).isEqualTo(35);
    assertThat(SkillAxis.PRESS_COVERAGE.extract(s)).isEqualTo(46);
    assertThat(SkillAxis.BALL_SKILLS.extract(s)).isEqualTo(57);
    assertThat(SkillAxis.SNAP_ACCURACY.extract(s)).isEqualTo(68);
  }

  @Test
  void values_coversEverySkillRecordField() {
    assertThat(SkillAxis.values()).hasSize(29);
  }
}
