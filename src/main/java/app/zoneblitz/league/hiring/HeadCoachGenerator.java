package app.zoneblitz.league.hiring;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.league.geography.Climate;
import app.zoneblitz.league.geography.Geography;
import app.zoneblitz.league.geography.MarketSize;
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

/**
 * Generates HC candidates from {@code data/bands/coach-market.json} tier {@code HC}. Implements the
 * hidden-info contract — true rating is sampled independently and never enters the price function.
 * Price signals (compensation, contract length, guaranteed money) derive from perceived features
 * only: age, total experience, archetype scarcity, and specialty.
 */
public final class HeadCoachGenerator implements CandidateGenerator {

  private static final double GUARANTEED_MONEY_FLOOR = 0.90;
  private static final double GUARANTEED_MONEY_CEIL = 1.00;
  private static final double TRUE_RATING_MEAN = 65.0;
  private static final double TRUE_RATING_STD = 12.0;

  private final HeadCoachMarketBands bands;
  private final NameGenerator names;

  public HeadCoachGenerator(NameGenerator names) {
    this(HeadCoachMarketBands.loadFromClasspath(), names);
  }

  public HeadCoachGenerator(HeadCoachMarketBands bands, NameGenerator names) {
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
    var isFirstTime = rng.nextDouble() < bands.firstTimeHcRate();
    var priorHcYears = isFirstTime ? 0 : sampleRetreadHcYears(totalExperience, rng);
    var ocYears = sampleCoordinatorYears(totalExperience, priorHcYears, rng);
    var positionCoachYears = Math.max(0, totalExperience - priorHcYears - ocYears);
    var experienceByRole =
        """
        {"HC": %d, "OC": %d, "POSITION_COACH": %d}"""
            .formatted(priorHcYears, ocYears, positionCoachYears);

    var trueRating = clamp(TRUE_RATING_MEAN + TRUE_RATING_STD * rng.nextGaussian(), 20.0, 99.0);
    var hiddenAttrs = attrsJson(trueRating);

    var compensation = perceivedCompensation(age, totalExperience, priorHcYears, archetype, rng);
    var contractLength = perceivedContractLength(priorHcYears, rng);
    var guaranteedMoney = perceivedGuaranteedMoney(priorHcYears, rng);

    var name = names.generate(rng);
    var candidate =
        new NewCandidate(
            /* poolId= */ 0L,
            CandidateKind.HEAD_COACH,
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
    if (u < bands.offenseShare()) {
      return CandidateArchetype.OFFENSIVE_PLAY_CALLER;
    }
    if (u < bands.offenseShare() + bands.defenseShare()) {
      return CandidateArchetype.DEFENSIVE_PLAY_CALLER;
    }
    return CandidateArchetype.CEO;
  }

  private SpecialtyPosition sampleSpecialty(CandidateArchetype archetype, RandomSource rng) {
    var offensive =
        List.of(
            SpecialtyPosition.QB,
            SpecialtyPosition.QB,
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
            SpecialtyPosition.LB,
            SpecialtyPosition.CB,
            SpecialtyPosition.CB,
            SpecialtyPosition.S);
    return switch (archetype) {
      case OFFENSIVE_PLAY_CALLER -> offensive.get((int) (rng.nextDouble() * offensive.size()));
      case DEFENSIVE_PLAY_CALLER -> defensive.get((int) (rng.nextDouble() * defensive.size()));
      case CEO -> {
        var u = rng.nextDouble();
        yield u < 0.6
            ? offensive.get((int) (rng.nextDouble() * offensive.size()))
            : defensive.get((int) (rng.nextDouble() * defensive.size()));
      }
      default -> throw new IllegalStateException("Non-HC archetype generated: " + archetype);
    };
  }

  private int sampleAge(RandomSource rng) {
    var v = triangular(bands.ageMin(), bands.ageMode(), bands.ageMax(), rng);
    return clampInt((int) Math.round(v), bands.ageMin(), bands.ageMax());
  }

  private int sampleTotalExperience(int age, RandomSource rng) {
    var career = age - 22;
    var raw =
        triangular(
            bands.experienceP10Years(),
            bands.experienceMeanYears(),
            bands.experienceP90Years() + 5,
            rng);
    return clampInt((int) Math.round(raw), 3, Math.max(3, career));
  }

  private int sampleRetreadHcYears(int totalExperience, RandomSource rng) {
    var upper = Math.max(1, Math.min(10, totalExperience - 2));
    return 1 + (int) (rng.nextDouble() * upper);
  }

  private int sampleCoordinatorYears(int totalExperience, int priorHcYears, RandomSource rng) {
    var available = Math.max(0, totalExperience - priorHcYears);
    if (available == 0) return 0;
    var mean = Math.min(available, Math.max(2, available / 2));
    var draw = (int) Math.round(mean + 2 * rng.nextGaussian());
    return clampInt(draw, 0, available);
  }

  private BigDecimal perceivedCompensation(
      int age,
      int totalExperience,
      int priorHcYears,
      CandidateArchetype archetype,
      RandomSource rng) {
    var base = triangular(bands.salaryP10(), bands.salaryP50(), bands.salaryP90(), rng);
    var ageMultiplier = ageSalaryMultiplier(age);
    var experienceMultiplier = 0.95 + Math.min(totalExperience, 25) * 0.006;
    var retreadMultiplier = 1.0 + Math.min(priorHcYears, 6) * 0.05;
    var archetypeMultiplier =
        switch (archetype) {
          case OFFENSIVE_PLAY_CALLER -> 1.05;
          case DEFENSIVE_PLAY_CALLER -> 0.95;
          case CEO -> 0.90;
          default -> 1.0;
        };
    var combined =
        base * ageMultiplier * experienceMultiplier * retreadMultiplier * archetypeMultiplier;
    var clamped =
        Math.max(bands.salaryP10() * 0.6, Math.min(bands.salaryCeiling() * 1.1, combined));
    return BigDecimal.valueOf(clamped).setScale(2, RoundingMode.HALF_UP);
  }

  private double ageSalaryMultiplier(int age) {
    var peak = 52.0;
    var deviation = Math.abs(age - peak);
    return Math.max(0.75, 1.05 - deviation * 0.01);
  }

  private int perceivedContractLength(int priorHcYears, RandomSource rng) {
    var u = rng.nextDouble();
    var base =
        u < 0.15
            ? bands.contractP10Years()
            : u < 0.65
                ? bands.contractModeYears()
                : u < 0.9 ? bands.contractP50Years() : bands.contractP90Years();
    return priorHcYears >= 2 ? Math.min(base + 1, bands.contractP90Years() + 1) : base;
  }

  private BigDecimal perceivedGuaranteedMoney(int priorHcYears, RandomSource rng) {
    var base =
        GUARANTEED_MONEY_FLOOR
            + rng.nextDouble() * (GUARANTEED_MONEY_CEIL - GUARANTEED_MONEY_FLOOR);
    var bump = priorHcYears >= 2 ? 0.02 : 0.0;
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
    for (var w : rawWeights) sum += w;
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
