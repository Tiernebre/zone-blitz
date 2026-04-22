package app.zoneblitz.league.hiring.hire;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.geography.Climate;
import app.zoneblitz.league.geography.Geography;
import app.zoneblitz.league.geography.MarketSize;
import app.zoneblitz.league.hiring.CandidatePreferences;
import app.zoneblitz.league.hiring.CompetitiveWindow;
import app.zoneblitz.league.hiring.InterviewInterest;
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
                    MarketSize.LARGE, Geography.NE, Climate.NEUTRAL, CompetitiveWindow.CONTENDER),
                prefs(
                    MarketSize.LARGE, Geography.NE, Climate.NEUTRAL, CompetitiveWindow.CONTENDER)))
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
                    MarketSize.LARGE, Geography.NE, Climate.NEUTRAL, CompetitiveWindow.CONTENDER)))
        .isEqualTo(InterviewInterest.NOT_INTERESTED);
  }

  @Test
  void score_partialMatch_returnsLukewarm() {
    // Market, prestige, and owner-stability match; geography/climate/window/facility miss.
    // 3/7 equal-weight dimensions at full fit → ~0.43 normalized → LUKEWARM band.
    assertThat(
            InterestScoring.score(
                new TeamProfile(
                    1L,
                    MarketSize.LARGE,
                    Geography.SW,
                    Climate.WARM,
                    new BigDecimal("80.00"),
                    CompetitiveWindow.REBUILD,
                    new BigDecimal("80.00"),
                    new BigDecimal("20.00"),
                    "AIR_RAID"),
                prefs(
                    MarketSize.LARGE, Geography.NE, Climate.NEUTRAL, CompetitiveWindow.CONTENDER)))
        .isEqualTo(InterviewInterest.LUKEWARM);
  }

  @Test
  void score_isDeterministic_sameInputsSameBucket() {
    var team = profile(MarketSize.MEDIUM, Geography.MW, Climate.COLD, CompetitiveWindow.NEUTRAL);
    var p = prefs(MarketSize.MEDIUM, Geography.MW, Climate.COLD, CompetitiveWindow.NEUTRAL);

    assertThat(InterestScoring.score(team, p)).isEqualTo(InterestScoring.score(team, p));
  }

  private static TeamProfile profile(
      MarketSize marketSize, Geography geography, Climate climate, CompetitiveWindow window) {
    return new TeamProfile(
        1L,
        marketSize,
        geography,
        climate,
        new BigDecimal("80.00"),
        window,
        new BigDecimal("80.00"),
        new BigDecimal("80.00"),
        "BALANCED");
  }

  private static CandidatePreferences prefs(
      MarketSize marketSize, Geography geography, Climate climate, CompetitiveWindow window) {
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
        "WEST_COAST",
        new BigDecimal("0.100"),
        new BigDecimal("70.00"),
        new BigDecimal("0.100"),
        new BigDecimal("70.00"),
        new BigDecimal("0.100"));
  }
}
