package app.zoneblitz.league.hiring.generation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.league.FakeRandomSource;
import app.zoneblitz.league.hiring.CandidateArchetype;
import app.zoneblitz.league.hiring.CandidateGenerator;
import app.zoneblitz.league.hiring.CandidateKind;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class HeadCoachGeneratorTests {

  private CandidateGenerator generator;

  @BeforeEach
  void setUp() {
    generator = new HeadCoachGenerator(app.zoneblitz.names.CuratedNameGenerator.maleDefaults());
  }

  @Test
  void generate_whenPoolSizeIsZeroOrNegative_throws() {
    var rng = new FakeRandomSource(42L);
    assertThatThrownBy(() -> generator.generate(0, rng))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> generator.generate(-1, rng))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void generate_producesRequestedPoolSizeWithAllRequiredFields() {
    var rng = new FakeRandomSource(7L);

    var candidates = generator.generate(20, rng);

    assertThat(candidates).hasSize(20);
    for (var generated : candidates) {
      var candidate = generated.candidate();
      assertThat(candidate.kind()).isEqualTo(CandidateKind.HEAD_COACH);
      assertThat(candidate.archetype())
          .isIn(
              CandidateArchetype.OFFENSIVE_PLAY_CALLER,
              CandidateArchetype.DEFENSIVE_PLAY_CALLER,
              CandidateArchetype.CEO);
      assertThat(candidate.age()).isBetween(32, 72);
      assertThat(candidate.totalExperienceYears()).isGreaterThanOrEqualTo(0);
      assertThat(candidate.experienceByRole()).contains("\"HC\"", "\"OC\"", "\"POSITION_COACH\"");
      assertThat(candidate.hiddenAttrs()).contains("overall");
      assertThat(candidate.scoutBranch()).isEmpty();

      var prefs = generated.preferences();
      assertThat(prefs.compensationTarget()).isGreaterThan(BigDecimal.ZERO);
      assertThat(prefs.contractLengthTarget()).isGreaterThan(0);
      assertThat(prefs.guaranteedMoneyTarget()).isBetween(BigDecimal.ZERO, BigDecimal.ONE);

      var weightSum =
          prefs
              .compensationWeight()
              .add(prefs.contractLengthWeight())
              .add(prefs.guaranteedMoneyWeight())
              .add(prefs.marketSizeWeight())
              .add(prefs.geographyWeight())
              .add(prefs.climateWeight())
              .add(prefs.franchisePrestigeWeight())
              .add(prefs.competitiveWindowWeight())
              .add(prefs.roleScopeWeight())
              .add(prefs.staffContinuityWeight())
              .add(prefs.schemeAlignmentWeight())
              .add(prefs.ownerStabilityWeight())
              .add(prefs.facilityQualityWeight());
      assertThat(weightSum.doubleValue()).isBetween(0.95, 1.05);
    }
  }

  @Test
  void generate_isDeterministicForSameSeed() {
    var candidatesA = generator.generate(50, new FakeRandomSource(1234L));
    var candidatesB = generator.generate(50, new FakeRandomSource(1234L));

    assertThat(candidatesA).isEqualTo(candidatesB);
  }

  @Test
  void generate_salaryDistributionMatchesBandPercentilesWithinTolerance() {
    var salaries =
        generator.generate(2_000, new FakeRandomSource(99L)).stream()
            .map(c -> c.preferences().compensationTarget().doubleValue())
            .sorted()
            .toList();

    var p10 = percentile(salaries, 0.10);
    var p50 = percentile(salaries, 0.50);
    var p90 = percentile(salaries, 0.90);

    // Band file HC salary: p10 5.5M, p50 8.5M, p90 14M, ceiling 20M.
    // Tolerance is loose because the generator overlays age/experience/archetype multipliers on the
    // base triangular, widening the distribution. The percentile ORDERING must hold and each
    // quantile must land within the band's reasonable window.
    assertThat(p10).isBetween(2_500_000.0, 8_500_000.0);
    assertThat(p50).isBetween(5_500_000.0, 12_000_000.0);
    assertThat(p90).isBetween(9_000_000.0, 22_000_000.0);
    assertThat(p10).isLessThan(p50);
    assertThat(p50).isLessThan(p90);
  }

  @Test
  void generate_firstTimeHcRateHonoredOverLargeSample() {
    var sample = generator.generate(3_000, new FakeRandomSource(2026L));

    var firstTimers =
        sample.stream().filter(c -> extractHcYears(c.candidate().experienceByRole()) == 0).count();
    var observedRate = firstTimers / (double) sample.size();

    // Band target 0.55; generator mixes first-time pool with retread multipliers across perceived
    // features. The rate must fall within ±5 percentage points of target.
    assertThat(observedRate).isBetween(0.50, 0.60);
  }

  @Test
  void generate_archetypeDistributionMatchesPlaycallerSplit() {
    var sample = generator.generate(3_000, new FakeRandomSource(17L));

    var offense =
        sample.stream()
                .filter(c -> c.candidate().archetype() == CandidateArchetype.OFFENSIVE_PLAY_CALLER)
                .count()
            / (double) sample.size();
    var defense =
        sample.stream()
                .filter(c -> c.candidate().archetype() == CandidateArchetype.DEFENSIVE_PLAY_CALLER)
                .count()
            / (double) sample.size();
    var ceo =
        sample.stream().filter(c -> c.candidate().archetype() == CandidateArchetype.CEO).count()
            / (double) sample.size();

    assertThat(offense).isBetween(0.50, 0.60);
    assertThat(defense).isBetween(0.25, 0.35);
    assertThat(ceo).isBetween(0.10, 0.20);
  }

  @Test
  void generate_trueRatingIsStatisticallyIndependentOfPrice() {
    var sample = generator.generate(2_000, new FakeRandomSource(5150L));

    var ratings = sample.stream().map(c -> parseOverall(c.candidate().hiddenAttrs())).toList();
    var prices =
        sample.stream().map(c -> c.preferences().compensationTarget().doubleValue()).toList();

    var correlation = pearsonCorrelation(ratings, prices);

    // If true rating leaked into the price function, |r| would be large (>~0.3). The hidden-info
    // contract requires near-zero correlation — tolerance is ±0.12 for a 2000-sample draw.
    assertThat(Math.abs(correlation)).isLessThan(0.12);
  }

  @Test
  void generate_mostExperiencedHeadCoachesCommandHighestPrices() {
    var sample = generator.generate(2_000, new FakeRandomSource(808L));

    var firstTimers =
        sample.stream()
            .filter(c -> extractHcYears(c.candidate().experienceByRole()) == 0)
            .mapToDouble(c -> c.preferences().compensationTarget().doubleValue())
            .average()
            .orElseThrow();
    var retreads =
        sample.stream()
            .filter(c -> extractHcYears(c.candidate().experienceByRole()) >= 3)
            .mapToDouble(c -> c.preferences().compensationTarget().doubleValue())
            .average()
            .orElseThrow();

    assertThat(retreads).isGreaterThan(firstTimers);
  }

  private static int extractHcYears(String experienceByRole) {
    var marker = "\"HC\":";
    var idx = experienceByRole.indexOf(marker);
    if (idx < 0) return 0;
    var rest = experienceByRole.substring(idx + marker.length()).trim();
    var end = 0;
    while (end < rest.length()
        && (Character.isDigit(rest.charAt(end)) || rest.charAt(end) == '-')) {
      end++;
    }
    return Integer.parseInt(rest.substring(0, end));
  }

  private static double parseOverall(String attrsJson) {
    var idx = attrsJson.indexOf(':');
    var end = attrsJson.indexOf('}', idx);
    return Double.parseDouble(attrsJson.substring(idx + 1, end).trim());
  }

  private static double percentile(List<Double> sortedValues, double p) {
    var idx = (int) Math.floor(p * (sortedValues.size() - 1));
    return sortedValues.get(idx);
  }

  private static double pearsonCorrelation(List<Double> xs, List<Double> ys) {
    var n = xs.size();
    var sumX = 0.0;
    var sumY = 0.0;
    for (var i = 0; i < n; i++) {
      sumX += xs.get(i);
      sumY += ys.get(i);
    }
    var meanX = sumX / n;
    var meanY = sumY / n;
    var covariance = 0.0;
    var varX = 0.0;
    var varY = 0.0;
    for (var i = 0; i < n; i++) {
      var dx = xs.get(i) - meanX;
      var dy = ys.get(i) - meanY;
      covariance += dx * dy;
      varX += dx * dx;
      varY += dy * dy;
    }
    return covariance / Math.sqrt(varX * varY);
  }
}
