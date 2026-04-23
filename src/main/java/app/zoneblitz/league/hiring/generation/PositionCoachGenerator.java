package app.zoneblitz.league.hiring.generation;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.league.hiring.CandidateArchetype;
import app.zoneblitz.league.hiring.CandidateKind;
import app.zoneblitz.league.hiring.GeneratedCandidate;
import app.zoneblitz.league.hiring.NewCandidate;
import app.zoneblitz.league.hiring.PositionCoachCandidateGenerator;
import app.zoneblitz.league.staff.SpecialtyPosition;
import app.zoneblitz.names.NameGenerator;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.IntStream;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Lightweight placeholder generator for position-coach candidates. Specialty matches the coached
 * position by construction (a QB coach has {@link SpecialtyPosition#QB} specialty). Draws salaries
 * from the {@code POSITION_COACH} entry in {@code staff-market.json} — anchored directly on
 * position-coach market data rather than a fraction of HC pay — per {@code
 * docs/technical/league-phases.md} v1.
 */
@Component
public final class PositionCoachGenerator implements PositionCoachCandidateGenerator {

  private static final double TRUE_RATING_MEAN = 58.0;
  private static final double TRUE_RATING_STD = 10.0;
  private static final double GUARANTEED_MONEY_FLOOR = 0.50;
  private static final double GUARANTEED_MONEY_CEIL = 0.85;
  private static final long SALARY_FLOOR = 250_000L;

  private final StaffMarketBands staffBands;
  private final NameGenerator names;

  @Autowired
  public PositionCoachGenerator(NameGenerator names) {
    this(StaffMarketBands.loadFromClasspath(), names);
  }

  public PositionCoachGenerator(StaffMarketBands staffBands, NameGenerator names) {
    this.staffBands = Objects.requireNonNull(staffBands, "staffBands");
    this.names = Objects.requireNonNull(names, "names");
  }

  @Override
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

    var salary = staffBands.salaryFor(CandidateKind.POSITION_COACH);
    var base = salary.p10() + rng.nextDouble() * (salary.p50() - salary.p10());
    var compRaw = Math.max(SALARY_FLOOR, base * (0.85 + rng.nextDouble() * 0.3));
    var compensation =
        BigDecimal.valueOf(Math.round(compRaw / 10_000.0) * 10_000L)
            .setScale(2, RoundingMode.HALF_UP);
    var contractLength = 1 + (int) Math.round(rng.nextDouble() * 2);
    var guaranteedMoney =
        BigDecimal.valueOf(
                GUARANTEED_MONEY_FLOOR
                    + rng.nextDouble() * (GUARANTEED_MONEY_CEIL - GUARANTEED_MONEY_FLOOR))
            .setScale(3, RoundingMode.HALF_UP);

    var name = names.generate(rng);
    var candidate =
        new NewCandidate(
            /* poolId= */ 0L,
            CandidateKind.POSITION_COACH,
            specialty,
            archetype,
            name.first(),
            name.last(),
            age,
            totalExperience,
            experienceByRole,
            "{\"overall\": %.2f}".formatted(trueRating),
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
