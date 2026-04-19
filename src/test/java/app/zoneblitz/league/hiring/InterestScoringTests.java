package app.zoneblitz.league.hiring;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.geography.Climate;
import app.zoneblitz.league.geography.Geography;
import app.zoneblitz.league.geography.MarketSize;
import app.zoneblitz.league.staff.RoleScope;
import app.zoneblitz.league.staff.StaffContinuity;
import app.zoneblitz.league.team.TeamProfile;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class InterestScoringTests {

  @Test
  void score_allTeamDimensionsMatch_returnsInterested() {
    assertThat(
            InterestScoring.score(
                profile(
                    MarketSize.LARGE,
                    Geography.NE,
                    Climate.NEUTRAL,
                    CompetitiveWindow.CONTENDER,
                    "WEST_COAST"),
                prefs(
                    MarketSize.LARGE,
                    Geography.NE,
                    Climate.NEUTRAL,
                    CompetitiveWindow.CONTENDER,
                    "WEST_COAST")))
        .isEqualTo(InterviewInterest.INTERESTED);
  }

  @Test
  void score_everyTeamDimensionMismatched_returnsNotInterested() {
    assertThat(
            InterestScoring.score(
                new TeamProfile(
                    1L,
                    MarketSize.SMALL,
                    Geography.SW,
                    Climate.WARM,
                    new BigDecimal("20.00"),
                    CompetitiveWindow.REBUILD,
                    new BigDecimal("20.00"),
                    new BigDecimal("20.00"),
                    "AIR_RAID"),
                prefs(
                    MarketSize.LARGE,
                    Geography.NE,
                    Climate.NEUTRAL,
                    CompetitiveWindow.CONTENDER,
                    "WEST_COAST")))
        .isEqualTo(InterviewInterest.NOT_INTERESTED);
  }

  @Test
  void score_partialMatch_returnsLukewarm() {
    // One of five categorical dimensions matches exactly; prestige/stability/facility score high.
    // Split should land between the two thresholds.
    assertThat(
            InterestScoring.score(
                profile(
                    MarketSize.LARGE,
                    Geography.SW,
                    Climate.WARM,
                    CompetitiveWindow.REBUILD,
                    "AIR_RAID"),
                prefs(
                    MarketSize.LARGE,
                    Geography.NE,
                    Climate.NEUTRAL,
                    CompetitiveWindow.CONTENDER,
                    "WEST_COAST")))
        .isEqualTo(InterviewInterest.LUKEWARM);
  }

  @Test
  void score_isDeterministic_sameInputsSameBucket() {
    var team =
        profile(
            MarketSize.MEDIUM, Geography.MW, Climate.COLD, CompetitiveWindow.NEUTRAL, "COVER_2");
    var p =
        prefs(MarketSize.MEDIUM, Geography.MW, Climate.COLD, CompetitiveWindow.NEUTRAL, "COVER_2");

    assertThat(InterestScoring.score(team, p)).isEqualTo(InterestScoring.score(team, p));
  }

  private static TeamProfile profile(
      MarketSize marketSize,
      Geography geography,
      Climate climate,
      CompetitiveWindow window,
      String scheme) {
    return new TeamProfile(
        1L,
        marketSize,
        geography,
        climate,
        new BigDecimal("80.00"),
        window,
        new BigDecimal("80.00"),
        new BigDecimal("80.00"),
        scheme);
  }

  private static CandidatePreferences prefs(
      MarketSize marketSize,
      Geography geography,
      Climate climate,
      CompetitiveWindow window,
      String scheme) {
    return new CandidatePreferences(
        1L,
        new BigDecimal("8500000.00"),
        new BigDecimal("0.180"),
        5,
        new BigDecimal("0.080"),
        new BigDecimal("0.850"),
        new BigDecimal("0.060"),
        marketSize,
        new BigDecimal("0.100"),
        geography,
        new BigDecimal("0.100"),
        climate,
        new BigDecimal("0.100"),
        new BigDecimal("70.00"),
        new BigDecimal("0.100"),
        window,
        new BigDecimal("0.100"),
        RoleScope.HIGH,
        new BigDecimal("0.050"),
        StaffContinuity.BRING_OWN,
        new BigDecimal("0.050"),
        scheme,
        new BigDecimal("0.100"),
        new BigDecimal("70.00"),
        new BigDecimal("0.100"),
        new BigDecimal("70.00"),
        new BigDecimal("0.100"));
  }
}
