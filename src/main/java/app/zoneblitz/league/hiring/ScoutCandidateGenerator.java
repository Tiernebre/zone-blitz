package app.zoneblitz.league.hiring;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.league.staff.SpecialtyPosition;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.IntStream;

/**
 * Lightweight placeholder generator for subordinate scout candidates (not DoS). Each generated
 * candidate has {@link CandidateKind#SCOUT} and a {@link ScoutBranch} reflecting college/pro
 * operation. Reuses the scout-market bands as a pricing anchor; a subordinate scout earns a
 * fraction of the DoS salary.
 */
public final class ScoutCandidateGenerator {

  private static final double SCOUT_SALARY_FRACTION = 0.18;
  private static final double TRUE_RATING_MEAN = 55.0;
  private static final double TRUE_RATING_STD = 10.0;
  private static final double SCOUTED_NOISE_STD = 9.0;
  private static final double GUARANTEED_MONEY_FLOOR = 0.30;
  private static final double GUARANTEED_MONEY_CEIL = 0.70;

  private final ScoutMarketBands bands;

  public ScoutCandidateGenerator() {
    this(ScoutMarketBands.loadFromClasspath());
  }

  public ScoutCandidateGenerator(ScoutMarketBands bands) {
    this.bands = Objects.requireNonNull(bands, "bands");
  }

  /** Generate {@code poolSize} subordinate scouts operating in the given {@code branch}. */
  public List<GeneratedCandidate> generate(int poolSize, ScoutBranch branch, RandomSource rng) {
    Objects.requireNonNull(branch, "branch");
    Objects.requireNonNull(rng, "rng");
    if (poolSize <= 0) {
      throw new IllegalArgumentException("poolSize must be > 0, was: " + poolSize);
    }
    return IntStream.range(0, poolSize).mapToObj(i -> generateOne(branch, rng)).toList();
  }

  private GeneratedCandidate generateOne(ScoutBranch branch, RandomSource rng) {
    var archetype =
        branch == ScoutBranch.COLLEGE
            ? CandidateArchetype.COLLEGE_EVALUATOR
            : CandidateArchetype.PRO_EVALUATOR;
    var specialty =
        SpecialtyPosition.values()[(int) (rng.nextDouble() * SpecialtyPosition.values().length)];
    var age = 28 + (int) Math.round(rng.nextDouble() * 22);
    var totalExperience = 3 + (int) Math.round(rng.nextDouble() * Math.min(18, age - 22));
    var experienceByRole =
        """
        {"SCOUT": %d, "AREA_SCOUT": %d}"""
            .formatted(totalExperience, Math.max(0, totalExperience - 2));

    var trueRating = clamp(TRUE_RATING_MEAN + TRUE_RATING_STD * rng.nextGaussian(), 20.0, 99.0);
    var scoutedRating = clamp(trueRating + SCOUTED_NOISE_STD * rng.nextGaussian(), 20.0, 99.0);

    var dosBase = bands.salaryP10() + rng.nextDouble() * (bands.salaryP50() - bands.salaryP10());
    var compensation =
        BigDecimal.valueOf(
                Math.max(90_000, dosBase * SCOUT_SALARY_FRACTION * (0.85 + rng.nextDouble() * 0.3)))
            .setScale(2, RoundingMode.HALF_UP);
    var contractLength = 1 + (int) Math.round(rng.nextDouble() * 2);
    var guaranteedMoney =
        BigDecimal.valueOf(
                GUARANTEED_MONEY_FLOOR
                    + rng.nextDouble() * (GUARANTEED_MONEY_CEIL - GUARANTEED_MONEY_FLOOR))
            .setScale(3, RoundingMode.HALF_UP);

    var candidate =
        new NewCandidate(
            /* poolId= */ 0L,
            CandidateKind.SCOUT,
            specialty,
            archetype,
            age,
            totalExperience,
            experienceByRole,
            "{\"overall\": %.2f}".formatted(trueRating),
            "{\"overall\": %.2f}".formatted(scoutedRating),
            Optional.of(branch));
    var preferences =
        StaffPreferencesFactory.uniform(compensation, contractLength, guaranteedMoney, rng);
    return new GeneratedCandidate(candidate, preferences);
  }

  @SuppressWarnings("unused")
  private static final List<ScoutBranch> BRANCHES = List.of(ScoutBranch.values());

  private static double clamp(double v, double lo, double hi) {
    return Math.max(lo, Math.min(hi, v));
  }
}
