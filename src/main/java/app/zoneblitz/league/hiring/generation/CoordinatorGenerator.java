package app.zoneblitz.league.hiring.generation;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.league.hiring.CandidateArchetype;
import app.zoneblitz.league.hiring.CandidateKind;
import app.zoneblitz.league.hiring.CoordinatorCandidateGenerator;
import app.zoneblitz.league.hiring.GeneratedCandidate;
import app.zoneblitz.league.hiring.NewCandidate;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.staff.SpecialtyPosition;
import app.zoneblitz.names.NameGenerator;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.IntStream;
import org.springframework.stereotype.Component;

/**
 * Lightweight placeholder generator for coordinator candidates (OC, DC, ST). Draws salaries from
 * per-role bands in {@code staff-market.json} — coordinator pay is now anchored directly on
 * coordinator market data rather than a fraction of HC pay — for v1 of {@link
 * LeaguePhase#ASSEMBLING_STAFF}. Specialty sampling is biased by the coordinator kind (OC favors
 * offensive positions, DC defensive, ST special teams).
 *
 * <p>Follows the hidden-info contract: true rating sampled independently; price signals derived
 * from perceived features only.
 */
@Component
public final class CoordinatorGenerator implements CoordinatorCandidateGenerator {

  private static final double TRUE_RATING_MEAN = 60.0;
  private static final double TRUE_RATING_STD = 10.0;
  private static final double GUARANTEED_MONEY_FLOOR = 0.60;
  private static final double GUARANTEED_MONEY_CEIL = 0.90;
  private static final long SALARY_FLOOR = 400_000L;

  private final StaffMarketBands staffBands;
  private final NameGenerator names;

  public CoordinatorGenerator(NameGenerator names) {
    this(StaffMarketBands.loadFromClasspath(), names);
  }

  public CoordinatorGenerator(StaffMarketBands staffBands, NameGenerator names) {
    this.staffBands = Objects.requireNonNull(staffBands, "staffBands");
    this.names = Objects.requireNonNull(names, "names");
  }

  @Override
  public List<GeneratedCandidate> generate(int poolSize, CandidateKind kind, RandomSource rng) {
    Objects.requireNonNull(kind, "kind");
    Objects.requireNonNull(rng, "rng");
    if (poolSize <= 0) {
      throw new IllegalArgumentException("poolSize must be > 0, was: " + poolSize);
    }
    if (!isCoordinator(kind)) {
      throw new IllegalArgumentException("not a coordinator kind: " + kind);
    }
    return IntStream.range(0, poolSize).mapToObj(i -> generateOne(kind, rng)).toList();
  }

  private GeneratedCandidate generateOne(CandidateKind kind, RandomSource rng) {
    var archetype = archetypeFor(kind, rng);
    var specialty = sampleSpecialty(kind, rng);
    var age = sampleAge(rng);
    var totalExperience = sampleTotalExperience(age, rng);
    var experienceByRole =
        """
        {"%s": %d}"""
            .formatted(kind.name(), Math.min(totalExperience, 10));

    var trueRating = clamp(TRUE_RATING_MEAN + TRUE_RATING_STD * rng.nextGaussian(), 20.0, 99.0);

    var compensation = perceivedCompensation(kind, age, totalExperience, rng);
    var contractLength = 2 + (int) Math.round(rng.nextDouble() * 2);
    var guaranteedMoney =
        BigDecimal.valueOf(
                GUARANTEED_MONEY_FLOOR
                    + rng.nextDouble() * (GUARANTEED_MONEY_CEIL - GUARANTEED_MONEY_FLOOR))
            .setScale(3, RoundingMode.HALF_UP);

    var name = names.generate(rng);
    var candidate =
        new NewCandidate(
            /* poolId= */ 0L,
            kind,
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

  private CandidateArchetype archetypeFor(CandidateKind kind, RandomSource rng) {
    return switch (kind) {
      case OFFENSIVE_COORDINATOR ->
          rng.nextDouble() < 0.7
              ? CandidateArchetype.OFFENSIVE_PLAY_CALLER
              : CandidateArchetype.OFFENSIVE_GURU;
      case DEFENSIVE_COORDINATOR ->
          rng.nextDouble() < 0.7
              ? CandidateArchetype.DEFENSIVE_PLAY_CALLER
              : CandidateArchetype.DEFENSIVE_GURU;
      case SPECIAL_TEAMS_COORDINATOR -> CandidateArchetype.TACTICIAN;
      case HEAD_COACH, DIRECTOR_OF_SCOUTING, POSITION_COACH, SCOUT ->
          throw new IllegalStateException("not a coordinator: " + kind);
    };
  }

  private SpecialtyPosition sampleSpecialty(CandidateKind kind, RandomSource rng) {
    var offensive =
        List.of(
            SpecialtyPosition.QB,
            SpecialtyPosition.WR,
            SpecialtyPosition.OL,
            SpecialtyPosition.RB,
            SpecialtyPosition.TE);
    var defensive =
        List.of(
            SpecialtyPosition.DL,
            SpecialtyPosition.EDGE,
            SpecialtyPosition.LB,
            SpecialtyPosition.CB,
            SpecialtyPosition.S);
    var specialTeams = List.of(SpecialtyPosition.K, SpecialtyPosition.P, SpecialtyPosition.LS);
    var choices =
        switch (kind) {
          case OFFENSIVE_COORDINATOR -> offensive;
          case DEFENSIVE_COORDINATOR -> defensive;
          case SPECIAL_TEAMS_COORDINATOR -> specialTeams;
          case HEAD_COACH, DIRECTOR_OF_SCOUTING, POSITION_COACH, SCOUT ->
              throw new IllegalStateException("not a coordinator: " + kind);
        };
    return choices.get((int) (rng.nextDouble() * choices.size()));
  }

  private int sampleAge(RandomSource rng) {
    return 34 + (int) Math.round(rng.nextDouble() * 20);
  }

  private int sampleTotalExperience(int age, RandomSource rng) {
    var career = Math.max(5, age - 24);
    var draw = 5 + (int) Math.round(rng.nextDouble() * 15);
    return Math.min(draw, career);
  }

  private BigDecimal perceivedCompensation(
      CandidateKind kind, int age, int totalExperience, RandomSource rng) {
    var salary = staffBands.salaryFor(kind);
    var base = salary.p10() + rng.nextDouble() * (salary.p50() - salary.p10());
    var ageMultiplier = 0.85 + Math.min(Math.abs(age - 48), 15) * -0.005;
    var experienceMultiplier = 0.9 + Math.min(totalExperience, 20) * 0.01;
    var value = base * ageMultiplier * experienceMultiplier;
    var rounded = Math.round(Math.max(SALARY_FLOOR, value) / 10_000.0) * 10_000L;
    return BigDecimal.valueOf(rounded).setScale(2, RoundingMode.HALF_UP);
  }

  private static boolean isCoordinator(CandidateKind kind) {
    return kind == CandidateKind.OFFENSIVE_COORDINATOR
        || kind == CandidateKind.DEFENSIVE_COORDINATOR
        || kind == CandidateKind.SPECIAL_TEAMS_COORDINATOR;
  }

  private static double clamp(double v, double lo, double hi) {
    return Math.max(lo, Math.min(hi, v));
  }
}
