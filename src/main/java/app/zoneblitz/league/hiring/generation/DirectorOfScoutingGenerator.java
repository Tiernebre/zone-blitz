package app.zoneblitz.league.hiring.generation;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.league.geography.Climate;
import app.zoneblitz.league.geography.Geography;
import app.zoneblitz.league.geography.MarketSize;
import app.zoneblitz.league.hiring.CandidateArchetype;
import app.zoneblitz.league.hiring.CandidateGenerator;
import app.zoneblitz.league.hiring.CandidateKind;
import app.zoneblitz.league.hiring.CompetitiveWindow;
import app.zoneblitz.league.hiring.GeneratedCandidate;
import app.zoneblitz.league.hiring.NewCandidate;
import app.zoneblitz.league.hiring.candidates.CandidatePreferencesDraft;
import app.zoneblitz.league.staff.RoleScope;
import app.zoneblitz.league.staff.SpecialtyPosition;
import app.zoneblitz.league.staff.StaffContinuity;
import app.zoneblitz.names.NameGenerator;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.IntStream;
import org.springframework.stereotype.Component;

/**
 * Generates Director-of-Scouting candidates from {@code data/bands/scout-market.json} tier {@code
 * DIRECTOR}. Mirrors {@link HeadCoachGenerator}: true rating is sampled independently; price
 * signals (compensation, contract length, guaranteed money) derive from perceived features only
 * (age, experience, archetype).
 *
 * <p>Scout-specific archetypes are TBD per {@code docs/technical/league-phases.md}; this generator
 * uses {@link CandidateArchetype#COLLEGE_EVALUATOR}, {@link CandidateArchetype#PRO_EVALUATOR}, and
 * {@link CandidateArchetype#GENERALIST} as placeholders keyed off the band's {@code
 * position_focus_split.generalist} share.
 */
@Component
public final class DirectorOfScoutingGenerator implements CandidateGenerator {

  private static final double TRUE_RATING_MEAN = 62.0;
  private static final double TRUE_RATING_STD = 11.0;
  private static final double GUARANTEED_MONEY_FLOOR = 0.55;
  private static final double GUARANTEED_MONEY_CEIL = 0.85;

  private final ScoutMarketBands bands;
  private final NameGenerator names;

  public DirectorOfScoutingGenerator(NameGenerator names) {
    this(ScoutMarketBands.loadFromClasspath(), names);
  }

  public DirectorOfScoutingGenerator(ScoutMarketBands bands, NameGenerator names) {
    this.bands = Objects.requireNonNull(bands, "bands");
    this.names = Objects.requireNonNull(names, "names");
  }

  @Override
  public List<GeneratedCandidate> generate(int poolSize, RandomSource rng) {
    Objects.requireNonNull(rng, "rng");
    if (poolSize <= 0) {
      throw new IllegalArgumentException("poolSize must be > 0, was: " + poolSize);
    }
    return IntStream.range(0, poolSize).mapToObj(i -> generateOne(rng)).toList();
  }

  private GeneratedCandidate generateOne(RandomSource rng) {
    var archetype = sampleArchetype(rng);
    var specialty = sampleSpecialty(archetype, rng);
    var age = sampleAge(rng);
    var totalExperience = sampleTotalExperience(age, rng);
    var priorDosYears = samplePriorDosYears(totalExperience, rng);
    var scoutYears = sampleScoutYears(totalExperience, priorDosYears, rng);
    var areaScoutYears = Math.max(0, totalExperience - priorDosYears - scoutYears);
    var experienceByRole =
        """
        {"DOS": %d, "SCOUT": %d, "AREA_SCOUT": %d}"""
            .formatted(priorDosYears, scoutYears, areaScoutYears);

    var trueRating = clamp(TRUE_RATING_MEAN + TRUE_RATING_STD * rng.nextGaussian(), 20.0, 99.0);
    var hiddenAttrs = attrsJson(trueRating);

    var compensation = perceivedCompensation(age, totalExperience, priorDosYears, archetype, rng);
    var contractLength = perceivedContractLength(priorDosYears, rng);
    var guaranteedMoney = perceivedGuaranteedMoney(priorDosYears, rng);

    var name = names.generate(rng);
    var candidate =
        new NewCandidate(
            /* poolId= */ 0L,
            CandidateKind.DIRECTOR_OF_SCOUTING,
            specialty,
            archetype,
            name.first(),
            name.last(),
            age,
            totalExperience,
            experienceByRole,
            hiddenAttrs,
            Optional.empty());
    var preferences = buildPreferences(compensation, contractLength, guaranteedMoney, rng);
    return new GeneratedCandidate(candidate, preferences);
  }

  private CandidateArchetype sampleArchetype(RandomSource rng) {
    var u = rng.nextDouble();
    if (u < bands.generalistShare()) {
      return CandidateArchetype.GENERALIST;
    }
    var remainder = 1.0 - bands.generalistShare();
    var collegeShare = remainder * 0.6;
    return u < bands.generalistShare() + collegeShare
        ? CandidateArchetype.COLLEGE_EVALUATOR
        : CandidateArchetype.PRO_EVALUATOR;
  }

  private SpecialtyPosition sampleSpecialty(CandidateArchetype archetype, RandomSource rng) {
    var positions = SpecialtyPosition.values();
    return positions[(int) (rng.nextDouble() * positions.length)];
  }

  private int sampleAge(RandomSource rng) {
    var v = triangular(bands.ageMin(), bands.ageMode(), bands.ageMax(), rng);
    return clampInt((int) Math.round(v), bands.ageMin(), bands.ageMax());
  }

  private int sampleTotalExperience(int age, RandomSource rng) {
    var career = Math.max(5, age - 22);
    var raw =
        triangular(
            bands.experienceP10Years(),
            bands.experienceMeanYears(),
            bands.experienceP90Years() + 4,
            rng);
    return clampInt((int) Math.round(raw), 5, career);
  }

  private int samplePriorDosYears(int totalExperience, RandomSource rng) {
    // First-time DoS is common — directors are usually newly-promoted cross-checkers.
    var isFirstTime = rng.nextDouble() < 0.65;
    if (isFirstTime) {
      return 0;
    }
    var upper = Math.max(1, Math.min(8, totalExperience - 5));
    return 1 + (int) (rng.nextDouble() * upper);
  }

  private int sampleScoutYears(int totalExperience, int priorDosYears, RandomSource rng) {
    var available = Math.max(0, totalExperience - priorDosYears);
    if (available == 0) return 0;
    var mean = Math.min(available, Math.max(2, available / 2));
    var draw = (int) Math.round(mean + 2 * rng.nextGaussian());
    return clampInt(draw, 0, available);
  }

  private BigDecimal perceivedCompensation(
      int age,
      int totalExperience,
      int priorDosYears,
      CandidateArchetype archetype,
      RandomSource rng) {
    var base = triangular(bands.salaryP10(), bands.salaryP50(), bands.salaryP90(), rng);
    var ageMultiplier = ageSalaryMultiplier(age);
    var experienceMultiplier = 0.90 + Math.min(totalExperience, 25) * 0.008;
    var retreadMultiplier = 1.0 + Math.min(priorDosYears, 6) * 0.04;
    var archetypeMultiplier =
        switch (archetype) {
          case COLLEGE_EVALUATOR -> 1.02;
          case PRO_EVALUATOR -> 0.98;
          case GENERALIST -> 1.05;
          default -> 1.0;
        };
    var combined =
        base * ageMultiplier * experienceMultiplier * retreadMultiplier * archetypeMultiplier;
    var clamped =
        Math.max(bands.salaryP10() * 0.5, Math.min(bands.salaryCeiling() * 1.1, combined));
    var rounded = Math.round(clamped / 10_000.0) * 10_000L;
    return BigDecimal.valueOf(rounded).setScale(2, RoundingMode.HALF_UP);
  }

  private double ageSalaryMultiplier(int age) {
    var peak = 50.0;
    var deviation = Math.abs(age - peak);
    return Math.max(0.8, 1.05 - deviation * 0.01);
  }

  private int perceivedContractLength(int priorDosYears, RandomSource rng) {
    var u = rng.nextDouble();
    var base =
        u < 0.15
            ? bands.contractP10Years()
            : u < 0.65
                ? bands.contractModeYears()
                : u < 0.9 ? bands.contractP50Years() : bands.contractP90Years();
    return priorDosYears >= 2 ? Math.min(base + 1, bands.contractP90Years() + 1) : base;
  }

  private BigDecimal perceivedGuaranteedMoney(int priorDosYears, RandomSource rng) {
    var base =
        GUARANTEED_MONEY_FLOOR
            + rng.nextDouble() * (GUARANTEED_MONEY_CEIL - GUARANTEED_MONEY_FLOOR);
    var bump = priorDosYears >= 2 ? 0.05 : 0.0;
    var value = Math.min(1.0, base + bump);
    return BigDecimal.valueOf(value).setScale(3, RoundingMode.HALF_UP);
  }

  private CandidatePreferencesDraft buildPreferences(
      BigDecimal compensation, int contractLength, BigDecimal guaranteedMoney, RandomSource rng) {
    var rawWeights = new double[13];
    for (var i = 0; i < rawWeights.length; i++) {
      rawWeights[i] = 0.25 + rng.nextDouble();
    }
    var sum = 0.0;
    for (var weight : rawWeights) sum += weight;
    var w = new BigDecimal[13];
    for (var i = 0; i < rawWeights.length; i++) {
      w[i] = BigDecimal.valueOf(rawWeights[i] / sum).setScale(3, RoundingMode.HALF_UP);
    }

    var marketSize = MarketSize.values()[(int) (rng.nextDouble() * MarketSize.values().length)];
    var geography = Geography.values()[(int) (rng.nextDouble() * Geography.values().length)];
    var climate = Climate.values()[(int) (rng.nextDouble() * Climate.values().length)];
    var roleScope = RoleScope.values()[(int) (rng.nextDouble() * RoleScope.values().length)];
    var staffContinuity =
        StaffContinuity.values()[(int) (rng.nextDouble() * StaffContinuity.values().length)];
    var competitiveWindow =
        CompetitiveWindow.values()[(int) (rng.nextDouble() * CompetitiveWindow.values().length)];
    var schemeAlignment = sampleSchemeAlignment(rng);

    return new CandidatePreferencesDraft(
        compensation,
        w[0],
        contractLength,
        w[1],
        guaranteedMoney,
        w[2],
        marketSize,
        w[3],
        geography,
        w[4],
        climate,
        w[5],
        BigDecimal.valueOf(50 + rng.nextDouble() * 30).setScale(2, RoundingMode.HALF_UP),
        w[6],
        competitiveWindow,
        w[7],
        roleScope,
        w[8],
        staffContinuity,
        w[9],
        schemeAlignment,
        w[10],
        BigDecimal.valueOf(50 + rng.nextDouble() * 30).setScale(2, RoundingMode.HALF_UP),
        w[11],
        BigDecimal.valueOf(50 + rng.nextDouble() * 30).setScale(2, RoundingMode.HALF_UP),
        w[12]);
  }

  private String sampleSchemeAlignment(RandomSource rng) {
    var schemes = List.of("SPREAD", "WEST_COAST", "AIR_RAID", "SMASHMOUTH", "COVER_2", "COVER_3");
    return schemes.get((int) (rng.nextDouble() * schemes.size()));
  }

  private String attrsJson(double rating) {
    return "{\"overall\": %.2f}".formatted(rating);
  }

  private static double triangular(double a, double c, double b, RandomSource rng) {
    var u = rng.nextDouble();
    var f = (c - a) / (b - a);
    if (u < f) {
      return a + Math.sqrt(u * (b - a) * (c - a));
    }
    return b - Math.sqrt((1 - u) * (b - a) * (b - c));
  }

  private static int clampInt(int v, int lo, int hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  private static double clamp(double v, double lo, double hi) {
    return Math.max(lo, Math.min(hi, v));
  }
}
