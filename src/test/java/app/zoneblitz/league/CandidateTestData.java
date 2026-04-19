package app.zoneblitz.league;

import java.math.BigDecimal;
import java.util.Optional;

/** Test data factories for candidate-domain records. Keeps tests free of boilerplate. */
final class CandidateTestData {

  private CandidateTestData() {}

  static NewCandidate newHeadCoach(long poolId) {
    return new NewCandidate(
        poolId,
        CandidateKind.HEAD_COACH,
        SpecialtyPosition.QB,
        CandidateArchetype.OFFENSIVE_PLAY_CALLER,
        43,
        18,
        "{\"OC\":10,\"QB_COACH\":4,\"HC\":0}",
        "{\"true_rating\":78}",
        "{\"scouted_rating\":76}",
        Optional.empty());
  }

  static NewCandidate newScout(long poolId, ScoutBranch branch) {
    return new NewCandidate(
        poolId,
        CandidateKind.SCOUT,
        SpecialtyPosition.CB,
        CandidateArchetype.COLLEGE_EVALUATOR,
        38,
        12,
        "{\"SCOUT\":12,\"AREA_SCOUT\":8}",
        "{\"true_rating\":70}",
        "{\"scouted_rating\":68}",
        Optional.of(branch));
  }

  static CandidatePreferences preferencesFor(long candidateId) {
    return new CandidatePreferences(
        candidateId,
        new BigDecimal("8500000.00"),
        new BigDecimal("0.180"),
        5,
        new BigDecimal("0.080"),
        new BigDecimal("0.850"),
        new BigDecimal("0.060"),
        MarketSize.LARGE,
        new BigDecimal("0.050"),
        Geography.NE,
        new BigDecimal("0.040"),
        Climate.NEUTRAL,
        new BigDecimal("0.030"),
        new BigDecimal("75.00"),
        new BigDecimal("0.070"),
        CompetitiveWindow.CONTENDER,
        new BigDecimal("0.090"),
        RoleScope.HIGH,
        new BigDecimal("0.120"),
        StaffContinuity.BRING_OWN,
        new BigDecimal("0.100"),
        "WEST_COAST",
        new BigDecimal("0.050"),
        new BigDecimal("60.00"),
        new BigDecimal("0.070"),
        new BigDecimal("80.00"),
        new BigDecimal("0.060"));
  }
}
