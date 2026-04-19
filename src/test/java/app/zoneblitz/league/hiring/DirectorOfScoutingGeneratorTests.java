package app.zoneblitz.league.hiring;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.league.FakeRandomSource;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class DirectorOfScoutingGeneratorTests {

  private CandidateGenerator generator;

  @BeforeEach
  void setUp() {
    generator = new DirectorOfScoutingGenerator();
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
      assertThat(candidate.kind()).isEqualTo(CandidateKind.DIRECTOR_OF_SCOUTING);
      assertThat(candidate.archetype())
          .isIn(
              CandidateArchetype.COLLEGE_EVALUATOR,
              CandidateArchetype.PRO_EVALUATOR,
              CandidateArchetype.GENERALIST);
      assertThat(candidate.age()).isBetween(32, 68);
      assertThat(candidate.totalExperienceYears()).isGreaterThanOrEqualTo(0);
      assertThat(candidate.experienceByRole()).contains("\"DOS\"", "\"SCOUT\"", "\"AREA_SCOUT\"");
      assertThat(candidate.hiddenAttrs()).contains("overall");
      assertThat(candidate.scoutedAttrs()).contains("overall");
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
  void generate_salaryDistributionHonorsScoutMarketBands() {
    var salaries =
        generator.generate(2_000, new FakeRandomSource(99L)).stream()
            .map(c -> c.preferences().compensationTarget().doubleValue())
            .sorted()
            .toList();

    var p10 = percentile(salaries, 0.10);
    var p50 = percentile(salaries, 0.50);
    var p90 = percentile(salaries, 0.90);

    // scout-market.json DIRECTOR salary bands: p10 300K, p50 475K, p90 800K, ceiling 1.2M.
    // The generator overlays age/experience/archetype multipliers, so tolerance is loose. Ordering
    // must hold and each quantile must fall within a reasonable window of the band value.
    assertThat(p10).isBetween(150_000.0, 500_000.0);
    assertThat(p50).isBetween(300_000.0, 700_000.0);
    assertThat(p90).isBetween(500_000.0, 1_400_000.0);
    assertThat(p10).isLessThan(p50);
    assertThat(p50).isLessThan(p90);
  }

  @Test
  void generate_generalistShareMatchesBandSplit() {
    var sample = generator.generate(3_000, new FakeRandomSource(17L));

    var generalists =
        sample.stream()
                .filter(c -> c.candidate().archetype() == CandidateArchetype.GENERALIST)
                .count()
            / (double) sample.size();

    // Band: position_focus_split.generalist = 0.70 for DIRECTOR tier.
    assertThat(generalists).isBetween(0.62, 0.78);
  }

  @Test
  void generate_trueRatingIsStatisticallyIndependentOfPrice() {
    var sample = generator.generate(2_000, new FakeRandomSource(5150L));

    var ratings = sample.stream().map(c -> parseOverall(c.candidate().hiddenAttrs())).toList();
    var prices =
        sample.stream().map(c -> c.preferences().compensationTarget().doubleValue()).toList();

    var correlation = pearsonCorrelation(ratings, prices);
    assertThat(Math.abs(correlation)).isLessThan(0.12);
  }

  @Test
  void generate_contractLengthsFallWithinBandRange() {
    var lengths =
        generator.generate(500, new FakeRandomSource(42L)).stream()
            .mapToInt(c -> c.preferences().contractLengthTarget())
            .toArray();

    // scout-market.json DIRECTOR contract_length_years: p10 3, p90 5.
    for (var length : lengths) {
      assertThat(length).isBetween(2, 7);
    }
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
