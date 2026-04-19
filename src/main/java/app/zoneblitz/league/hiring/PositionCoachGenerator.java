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
 * Lightweight placeholder generator for position-coach candidates. Specialty matches the coached
 * position by construction (a QB coach has {@link SpecialtyPosition#QB} specialty). Reuses the HC
 * band file as a pricing anchor — position coaches earn a fraction of HC salaries — per {@code
 * docs/technical/league-phases.md} v1.
 */
public final class PositionCoachGenerator {

  private static final double POSITION_COACH_SALARY_FRACTION = 0.10;
  private static final double TRUE_RATING_MEAN = 58.0;
  private static final double TRUE_RATING_STD = 10.0;
  private static final double SCOUTED_NOISE_STD = 8.0;
  private static final double GUARANTEED_MONEY_FLOOR = 0.50;
  private static final double GUARANTEED_MONEY_CEIL = 0.85;

  private final HeadCoachMarketBands bands;

  public PositionCoachGenerator() {
    this(HeadCoachMarketBands.loadFromClasspath());
  }

  public PositionCoachGenerator(HeadCoachMarketBands bands) {
    this.bands = Objects.requireNonNull(bands, "bands");
  }

  /**
   * Generate {@code poolSize} position coach candidates specialized in {@code specialty}. All
   * returned candidates have {@link CandidateKind#POSITION_COACH} and matching specialty.
   */
  public List<GeneratedCandidate> generate(
      int poolSize, SpecialtyPosition specialty, RandomSource rng) {
    Objects.requireNonNull(specialty, "specialty");
    Objects.requireNonNull(rng, "rng");
    if (poolSize <= 0) {
      throw new IllegalArgumentException("poolSize must be > 0, was: " + poolSize);
    }
    return IntStream.range(0, poolSize).mapToObj(i -> generateOne(specialty, rng)).toList();
  }

  private GeneratedCandidate generateOne(SpecialtyPosition specialty, RandomSource rng) {
    var archetype =
        rng.nextDouble() < 0.7 ? CandidateArchetype.TEACHER : CandidateArchetype.TACTICIAN;
    var age = 30 + (int) Math.round(rng.nextDouble() * 22);
    var totalExperience = 3 + (int) Math.round(rng.nextDouble() * Math.min(15, age - 22));
    var experienceByRole =
        """
        {"POSITION_COACH": %d}"""
            .formatted(totalExperience);

    var trueRating = clamp(TRUE_RATING_MEAN + TRUE_RATING_STD * rng.nextGaussian(), 20.0, 99.0);
    var scoutedRating = clamp(trueRating + SCOUTED_NOISE_STD * rng.nextGaussian(), 20.0, 99.0);

    var hcBase = bands.salaryP10() + rng.nextDouble() * (bands.salaryP50() - bands.salaryP10());
    var compensation =
        BigDecimal.valueOf(
                Math.max(
                    250_000,
                    hcBase * POSITION_COACH_SALARY_FRACTION * (0.85 + rng.nextDouble() * 0.3)))
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
            CandidateKind.POSITION_COACH,
            specialty,
            archetype,
            age,
            totalExperience,
            experienceByRole,
            "{\"overall\": %.2f}".formatted(trueRating),
            "{\"overall\": %.2f}".formatted(scoutedRating),
            Optional.empty());
    var preferences =
        StaffPreferencesFactory.uniform(compensation, contractLength, guaranteedMoney, rng);
    return new GeneratedCandidate(candidate, preferences);
  }

  @SuppressWarnings("unused")
  private static final List<SpecialtyPosition> ALL_POSITIONS = List.of(SpecialtyPosition.values());

  private static double clamp(double v, double lo, double hi) {
    return Math.max(lo, Math.min(hi, v));
  }
}
