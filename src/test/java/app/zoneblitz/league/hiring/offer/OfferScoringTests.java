package app.zoneblitz.league.hiring.offer;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.geography.Climate;
import app.zoneblitz.league.geography.Geography;
import app.zoneblitz.league.geography.MarketSize;
import app.zoneblitz.league.hiring.CandidateTestData;
import app.zoneblitz.league.hiring.CompetitiveWindow;
import app.zoneblitz.league.hiring.OfferTerms;
import app.zoneblitz.league.team.TeamProfile;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class OfferScoringTests {

  private static final TeamProfile NE_LARGE_COLD =
      new TeamProfile(
          1L,
          MarketSize.LARGE,
          Geography.NE,
          Climate.COLD,
          new BigDecimal("50.00"),
          CompetitiveWindow.NEUTRAL,
          new BigDecimal("50.00"),
          new BigDecimal("50.00"),
          "WEST_COAST");

  private static final TeamProfile SE_LARGE_WARM =
      new TeamProfile(
          2L,
          MarketSize.LARGE,
          Geography.SE,
          Climate.WARM,
          new BigDecimal("50.00"),
          CompetitiveWindow.NEUTRAL,
          new BigDecimal("50.00"),
          new BigDecimal("50.00"),
          "WEST_COAST");

  @Test
  void score_isDeterministic() {
    var prefs = CandidateTestData.preferencesFor(1L);
    var offer = fullyMatchingOffer();

    var first = OfferScoring.score(offer, NE_LARGE_COLD, prefs);
    var second = OfferScoring.score(offer, NE_LARGE_COLD, prefs);

    assertThat(first).isEqualTo(second);
  }

  @Test
  void score_preferredGeographyOutscoresUnpreferred() {
    // Candidate prefs NE + cold. NE_LARGE_COLD matches on geography+climate, SE_LARGE_WARM misses.
    var prefs = CandidateTestData.preferencesFor(1L);
    var offer = fullyMatchingOffer();

    var neScore = OfferScoring.score(offer, NE_LARGE_COLD, prefs);
    var seScore = OfferScoring.score(offer, SE_LARGE_WARM, prefs);

    assertThat(neScore).isGreaterThan(seScore);
  }

  @Test
  void score_offerAtOrAboveCompensationTarget_hitsFullCompensationFit() {
    var prefs = CandidateTestData.preferencesFor(1L);
    var atTarget =
        new OfferTerms(
            prefs.compensationTarget(),
            prefs.contractLengthTarget(),
            prefs.guaranteedMoneyTarget(),
            prefs.roleScopeTarget(),
            prefs.staffContinuityTarget());
    var below =
        new OfferTerms(
            new BigDecimal("1"),
            prefs.contractLengthTarget(),
            prefs.guaranteedMoneyTarget(),
            prefs.roleScopeTarget(),
            prefs.staffContinuityTarget());

    var atScore = OfferScoring.score(atTarget, NE_LARGE_COLD, prefs);
    var belowScore = OfferScoring.score(below, NE_LARGE_COLD, prefs);

    assertThat(atScore).isGreaterThan(belowScore);
  }

  @Test
  void score_contractLengthAtTarget_beatsOffBy3() {
    var prefs = CandidateTestData.preferencesFor(1L);
    var matching = fullyMatchingOffer();
    var offBy3 =
        new OfferTerms(
            prefs.compensationTarget(),
            prefs.contractLengthTarget() + 3,
            prefs.guaranteedMoneyTarget(),
            prefs.roleScopeTarget(),
            prefs.staffContinuityTarget());

    assertThat(OfferScoring.score(matching, NE_LARGE_COLD, prefs))
        .isGreaterThan(OfferScoring.score(offBy3, NE_LARGE_COLD, prefs));
  }

  @Test
  void score_equalFootingDynamicDimensions_doNotDifferentiateFranchises() {
    // Two profiles identical in static fields; dynamic fields are equal-footing constants by
    // construction. Same prefs + same offer must score identically.
    var prefs = CandidateTestData.preferencesFor(1L);
    var offer = fullyMatchingOffer();
    var a =
        new TeamProfile(
            10L,
            MarketSize.LARGE,
            Geography.NE,
            Climate.COLD,
            new BigDecimal("50.00"),
            CompetitiveWindow.NEUTRAL,
            new BigDecimal("50.00"),
            new BigDecimal("50.00"),
            "BALANCED");
    var b =
        new TeamProfile(
            11L,
            MarketSize.LARGE,
            Geography.NE,
            Climate.COLD,
            new BigDecimal("50.00"),
            CompetitiveWindow.NEUTRAL,
            new BigDecimal("50.00"),
            new BigDecimal("50.00"),
            "BALANCED");

    assertThat(OfferScoring.score(offer, a, prefs)).isEqualTo(OfferScoring.score(offer, b, prefs));
  }

  private static OfferTerms fullyMatchingOffer() {
    var prefs = CandidateTestData.preferencesFor(1L);
    return new OfferTerms(
        prefs.compensationTarget(),
        prefs.contractLengthTarget(),
        prefs.guaranteedMoneyTarget(),
        prefs.roleScopeTarget(),
        prefs.staffContinuityTarget());
  }
}
