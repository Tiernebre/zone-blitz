package app.zoneblitz.gamesimulator.roster;

import static app.zoneblitz.gamesimulator.roster.PlayerBuilder.aPlayer;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PlayerBuilderTests {

  @Test
  void defaults_produceMidTierQuarterbackWithAllAxesAtFifty() {
    var p = aPlayer().build();

    assertThat(p.position()).isEqualTo(Position.QB);
    assertThat(p.physical()).isEqualTo(Physical.average());
    assertThat(p.skill()).isEqualTo(Skill.average());
    assertThat(p.tendencies()).isEqualTo(Tendencies.average());
  }

  @Test
  void asBoxSafety_paintsRunSupportShape() {
    var p = aPlayer().asBoxSafety().build();

    assertThat(p.position()).isEqualTo(Position.S);
    assertThat(p.skill().tackling()).isGreaterThan(p.skill().coverageTechnique());
    assertThat(p.skill().blockShedding()).isGreaterThan(60);
    assertThat(p.physical().bend()).isLessThan(60);
  }

  @Test
  void asRangeSafety_paintsCoverageShape() {
    var p = aPlayer().asRangeSafety().build();

    assertThat(p.position()).isEqualTo(Position.S);
    assertThat(p.skill().coverageTechnique()).isGreaterThan(p.skill().tackling());
    assertThat(p.physical().speed()).isGreaterThan(75);
    assertThat(p.physical().bend()).isGreaterThan(60);
  }

  @Test
  void asScrambler_paintsAthleticQbShape() {
    var p = aPlayer().asScrambler().build();

    assertThat(p.position()).isEqualTo(Position.QB);
    assertThat(p.physical().speed()).isGreaterThanOrEqualTo(80);
    assertThat(p.physical().acceleration()).isGreaterThanOrEqualTo(80);
  }

  @Test
  void asPocketPasser_paintsHighProcessingShape() {
    var p = aPlayer().asPocketPasser().build();

    assertThat(p.position()).isEqualTo(Position.QB);
    assertThat(p.tendencies().processing()).isGreaterThanOrEqualTo(80);
    assertThat(p.tendencies().footballIq()).isGreaterThanOrEqualTo(80);
    assertThat(p.physical().speed()).isLessThanOrEqualTo(60);
  }

  @Test
  void withOverride_takesPrecedenceOverPreset() {
    var p = aPlayer().asBoxSafety().withSpeed(99).build();

    assertThat(p.physical().speed()).isEqualTo(99);
    assertThat(p.skill().tackling()).isGreaterThan(70);
  }

  @Test
  void withId_acceptsHighLowConvenienceForm() {
    var p = aPlayer().withId(7L, 7L).build();

    assertThat(p.id().value().getMostSignificantBits()).isEqualTo(7L);
  }
}
