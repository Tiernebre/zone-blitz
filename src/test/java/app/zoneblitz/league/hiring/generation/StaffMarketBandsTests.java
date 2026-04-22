package app.zoneblitz.league.hiring.generation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.league.hiring.CandidateKind;
import org.junit.jupiter.api.Test;

class StaffMarketBandsTests {

  @Test
  void loadFromClasspath_defaultResource_loadsEveryCandidateKind() {
    var bands = StaffMarketBands.loadFromClasspath();

    for (var kind : CandidateKind.values()) {
      assertThat(bands.contractLengthFor(kind)).isNotNull();
      assertThat(bands.guaranteePctFor(kind)).isNotNull();
      assertThat(bands.salaryFor(kind)).isNotNull();
    }
  }

  @Test
  void salaryFor_headCoach_matchesBlueprintSeedValues() {
    var bands = StaffMarketBands.loadFromClasspath();

    var salary = bands.salaryFor(CandidateKind.HEAD_COACH);

    assertThat(salary.p10()).isEqualTo(5_500_000L);
    assertThat(salary.p50()).isEqualTo(8_500_000L);
    assertThat(salary.p90()).isEqualTo(14_000_000L);
    assertThat(salary.ceiling()).isEqualTo(20_000_000L);
  }

  @Test
  void contractLengthFor_headCoach_matchesBlueprintSeedValues() {
    var bands = StaffMarketBands.loadFromClasspath();

    var length = bands.contractLengthFor(CandidateKind.HEAD_COACH);

    assertThat(length.min()).isEqualTo(3);
    assertThat(length.mode()).isEqualTo(5);
    assertThat(length.max()).isEqualTo(6);
  }

  @Test
  void guaranteePctFor_headCoach_matchesBlueprintSeedValues() {
    var bands = StaffMarketBands.loadFromClasspath();

    var guarantee = bands.guaranteePctFor(CandidateKind.HEAD_COACH);

    assertThat(guarantee.min()).isEqualTo(0.95);
    assertThat(guarantee.typical()).isEqualTo(1.00);
    assertThat(guarantee.max()).isEqualTo(1.00);
  }

  @Test
  void salaryFor_offensiveCoordinator_matchesBlueprintSeedValues() {
    var bands = StaffMarketBands.loadFromClasspath();

    var salary = bands.salaryFor(CandidateKind.OFFENSIVE_COORDINATOR);

    assertThat(salary.p10()).isEqualTo(1_500_000L);
    assertThat(salary.p50()).isEqualTo(2_300_000L);
    assertThat(salary.p90()).isEqualTo(4_000_000L);
    assertThat(salary.ceiling()).isEqualTo(6_500_000L);
  }

  @Test
  void salaryFor_directorOfScouting_matchesBlueprintSeedValues() {
    var bands = StaffMarketBands.loadFromClasspath();

    var salary = bands.salaryFor(CandidateKind.DIRECTOR_OF_SCOUTING);

    assertThat(salary.p10()).isEqualTo(300_000L);
    assertThat(salary.p50()).isEqualTo(475_000L);
    assertThat(salary.p90()).isEqualTo(800_000L);
    assertThat(salary.ceiling()).isEqualTo(1_200_000L);
  }

  @Test
  void salaryFor_scout_matchesBlueprintSeedValues() {
    var bands = StaffMarketBands.loadFromClasspath();

    var salary = bands.salaryFor(CandidateKind.SCOUT);

    assertThat(salary.p10()).isEqualTo(50_000L);
    assertThat(salary.p50()).isEqualTo(120_000L);
    assertThat(salary.p90()).isEqualTo(250_000L);
    assertThat(salary.ceiling()).isEqualTo(400_000L);
  }

  @Test
  void loadFromClasspath_missingResource_throws() {
    assertThatThrownBy(() -> StaffMarketBands.loadFromClasspath("/bands/does-not-exist.json"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("not found");
  }
}
