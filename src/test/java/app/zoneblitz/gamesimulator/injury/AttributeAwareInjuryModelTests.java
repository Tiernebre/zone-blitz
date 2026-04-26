package app.zoneblitz.gamesimulator.injury;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.environment.Surface;
import app.zoneblitz.gamesimulator.event.InjurySeverity;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.TestPersonnel;
import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.resolver.RunOutcome;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Physical;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Skill;
import app.zoneblitz.gamesimulator.roster.Tendencies;
import java.util.List;
import java.util.Optional;
import java.util.Random;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AttributeAwareInjuryModelTests {

  private final InjuryModel model = new AttributeAwareInjuryModel();

  @Test
  void draw_passIncomplete_neverInjures() {
    var rng = new SeededRandomSource(1L);
    var outcome =
        new PassOutcome.PassIncomplete(
            new PlayerId(new UUID(1, 1)),
            new PlayerId(new UUID(1, 2)),
            10,
            app.zoneblitz.gamesimulator.event.IncompleteReason.OVERTHROWN,
            Optional.empty());

    var draws =
        model.draw(
            outcome,
            TestPersonnel.baselineOffense(),
            TestPersonnel.baselineDefense(),
            Side.HOME,
            Surface.GRASS,
            rng);

    assertThat(draws).isEmpty();
  }

  @Test
  void draw_zeroToughness_injuresMuchMoreOftenThanHundredToughness() {
    var weakRb = playerWith(Position.RB, 0, 50, 50, 50, "weak-rb");
    var strongRb = playerWith(Position.RB, 100, 50, 50, 50, "strong-rb");
    var weakOffense = TestPersonnel.offenseWith(weakRb);
    var strongOffense = TestPersonnel.offenseWith(strongRb);

    var weakInjuries = countInjuriesAcrossSnaps(weakRb, weakOffense, 20_000, 9001L);
    var strongInjuries = countInjuriesAcrossSnaps(strongRb, strongOffense, 20_000, 9001L);

    assertThat(weakInjuries)
        .as("weak: %d, strong: %d", weakInjuries, strongInjuries)
        .isGreaterThan(strongInjuries * 2);
  }

  @Test
  void draw_severityDistribution_skewsTowardPlayAndDriveTiers() {
    var injuries = sampleManyInjuries(50_000, 4242L);
    var byTier = countBy(injuries, InjuryDraw::severity);

    var play = byTier.getOrDefault(InjurySeverity.PLAY, 0);
    var drive = byTier.getOrDefault(InjurySeverity.DRIVE, 0);
    var game = byTier.getOrDefault(InjurySeverity.GAME_ENDING, 0);
    var multi = byTier.getOrDefault(InjurySeverity.MULTI_GAME, 0);

    assertThat(injuries).isNotEmpty();
    var total = injuries.size();
    assertThat(play).as("PLAY tier should be the modal severity").isGreaterThan(total / 2);
    assertThat(drive).as("DRIVE tier present").isGreaterThan(total / 10);
    assertThat(game).as("GAME_ENDING tier present").isGreaterThan(total / 50);
    assertThat(multi).as("MULTI_GAME tier present").isGreaterThan(0);
    // Catastrophic tier strictly less than the routine tier.
    assertThat(multi).isLessThan(play);
  }

  @Test
  void draw_turfSurface_yieldsMoreInjuriesThanGrassAtFixedRng() {
    var grass = countInjuriesOnSurface(Surface.GRASS, 10_000, 7L);
    var turf = countInjuriesOnSurface(Surface.TURF, 10_000, 7L);

    assertThat(turf).isGreaterThan(grass);
  }

  @Test
  void draw_sack_injuriesAttributedAcrossBothSides() {
    var offense = TestPersonnel.baselineOffense();
    var defense = TestPersonnel.baselineDefense();
    var qbId = offense.quarterback().id();
    var sackerId = defense.players().get(0).id();
    var outcome =
        new PassOutcome.Sack(
            qbId,
            List.of(sackerId),
            7,
            Optional.<app.zoneblitz.gamesimulator.event.FumbleOutcome>empty());

    var rng = new SeededRandomSource(1234L);
    var hadOffense = false;
    var hadDefense = false;
    for (var i = 0; i < 5_000 && !(hadOffense && hadDefense); i++) {
      var draws = model.draw(outcome, offense, defense, Side.HOME, Surface.GRASS, rng);
      for (var d : draws) {
        if (d.side() == Side.HOME) hadOffense = true;
        if (d.side() == Side.AWAY) hadDefense = true;
      }
    }

    assertThat(hadOffense).isTrue();
    assertThat(hadDefense).isTrue();
  }

  // --- new multiplier tests -------------------------------------------------------------------

  @Test
  void draw_highAgilityRb_injuredLessOftenOnTackle_thanLowAgilityRb() {
    // High agility (90) vs low agility (10), all else average, TACKLE contact (run play).
    var agilityRb = playerWithAgility(Position.RB, 90, "agile-rb");
    var clumsyRb = playerWithAgility(Position.RB, 10, "clumsy-rb");
    var agilityOffense = TestPersonnel.offenseWith(agilityRb);
    var clumsyOffense = TestPersonnel.offenseWith(clumsyRb);

    var agilityInjuries = countInjuriesAcrossSnaps(agilityRb, agilityOffense, 30_000, 55555L);
    var clumsyInjuries = countInjuriesAcrossSnaps(clumsyRb, clumsyOffense, 30_000, 55555L);

    assertThat(agilityInjuries)
        .as(
            "agile RB injuries=%d should be fewer than clumsy RB injuries=%d on tackles",
            agilityInjuries, clumsyInjuries)
        .isLessThan(clumsyInjuries);
  }

  @Test
  void draw_highStrengthQb_injuredLessOftenOnSack_thanLowStrengthQb() {
    // High strength (90) vs low strength (10) for QB on sack exposure.
    var strongQb = playerWithStrength(Position.QB, 90, "strong-qb");
    var weakQb = playerWithStrength(Position.QB, 10, "weak-qb");

    var strongInjuries = countSackInjuriesForQb(strongQb, 30_000, 77777L);
    var weakInjuries = countSackInjuriesForQb(weakQb, 30_000, 77777L);

    assertThat(strongInjuries)
        .as(
            "strong QB injuries=%d should be fewer than weak QB injuries=%d on sacks",
            strongInjuries, weakInjuries)
        .isLessThan(weakInjuries);
  }

  @Test
  void draw_highFootballIqPlayer_injuredLessOftenThanLowFootballIqPlayer() {
    // Football IQ acts as awareness (avoids blindside); high vs low on a TACKLE play.
    var smartRb = playerWithFootballIq(Position.RB, 90, "smart-rb");
    var unawareRb = playerWithFootballIq(Position.RB, 10, "unaware-rb");
    var smartOffense = TestPersonnel.offenseWith(smartRb);
    var unawareOffense = TestPersonnel.offenseWith(unawareRb);

    var smartInjuries = countInjuriesAcrossSnaps(smartRb, smartOffense, 30_000, 88888L);
    var unawareInjuries = countInjuriesAcrossSnaps(unawareRb, unawareOffense, 30_000, 88888L);

    assertThat(smartInjuries)
        .as(
            "high-IQ RB injuries=%d should be fewer than low-IQ RB injuries=%d",
            smartInjuries, unawareInjuries)
        .isLessThan(unawareInjuries);
  }

  @Test
  void physicalMultiplier_averageProfile_isOne() {
    var physical = Physical.average();
    var tendencies = Tendencies.average();

    var tackleM =
        AttributeAwareInjuryModel.physicalMultiplier(physical, tendencies, ContactType.TACKLE);
    var sackM =
        AttributeAwareInjuryModel.physicalMultiplier(physical, tendencies, ContactType.SACK);
    var pileM =
        AttributeAwareInjuryModel.physicalMultiplier(physical, tendencies, ContactType.PILE);

    assertThat(tackleM).isEqualTo(1.0);
    assertThat(sackM).isEqualTo(1.0);
    assertThat(pileM).isEqualTo(1.0);
  }

  @Test
  void physicalMultiplier_extremeEliteProfile_doesNotExceedEnvelopeBound() {
    // All physical axes at 100 — maximum score should be clamped to 1 − PHYSICAL_ENVELOPE.
    var physical = new Physical(100, 100, 100, 100, 100, 100, 100, 100);
    var tendencies = new Tendencies(50, 50, 100, 50, 50, 50, 50, 50, 50);

    var m = AttributeAwareInjuryModel.physicalMultiplier(physical, tendencies, ContactType.TACKLE);

    assertThat(m).isEqualTo(1.0 - AttributeAwareInjuryModel.PHYSICAL_ENVELOPE);
  }

  @Test
  void physicalMultiplier_extremePoorProfile_doesNotExceedEnvelopeBound() {
    // All physical axes at 0 — minimum score should be clamped to 1 + PHYSICAL_ENVELOPE.
    var physical = new Physical(0, 0, 0, 0, 0, 0, 0, 0);
    var tendencies = new Tendencies(50, 50, 0, 50, 50, 50, 50, 50, 50);

    var m = AttributeAwareInjuryModel.physicalMultiplier(physical, tendencies, ContactType.TACKLE);

    assertThat(m).isEqualTo(1.0 + AttributeAwareInjuryModel.PHYSICAL_ENVELOPE);
  }

  // --- helpers ----------------------------------------------------------------------------------

  private int countInjuriesAcrossSnaps(
      Player carrier, OffensivePersonnel offense, int snaps, long seed) {
    var rng = new SeededRandomSource(seed);
    var outcome =
        new RunOutcome.Run(
            carrier.id(),
            app.zoneblitz.gamesimulator.event.RunConcept.INSIDE_ZONE,
            5,
            Optional.empty(),
            Optional.empty(),
            false);
    var count = 0;
    for (var i = 0; i < snaps; i++) {
      var draws =
          model.draw(
              outcome, offense, TestPersonnel.baselineDefense(), Side.HOME, Surface.GRASS, rng);
      count += draws.size();
    }
    return count;
  }

  private int countSackInjuriesForQb(Player qb, int snaps, long seed) {
    var rng = new SeededRandomSource(seed);
    var offense = TestPersonnel.offenseWith(qb);
    var defense = TestPersonnel.baselineDefense();
    var sackerId = defense.players().get(0).id();
    var outcome =
        new PassOutcome.Sack(
            qb.id(),
            List.of(sackerId),
            7,
            Optional.<app.zoneblitz.gamesimulator.event.FumbleOutcome>empty());
    var count = 0;
    for (var i = 0; i < snaps; i++) {
      var draws = model.draw(outcome, offense, defense, Side.HOME, Surface.GRASS, rng);
      // Count only the QB's injuries (Side.HOME = offense).
      count += (int) draws.stream().filter(d -> d.player().equals(qb.id())).count();
    }
    return count;
  }

  private int countInjuriesOnSurface(Surface surface, int snaps, long seed) {
    var rng = new SeededRandomSource(seed);
    var carrier = playerWith(Position.RB, 50, 50, 50, 50, "rb");
    var offense = TestPersonnel.offenseWith(carrier);
    var outcome =
        new RunOutcome.Run(
            carrier.id(),
            app.zoneblitz.gamesimulator.event.RunConcept.INSIDE_ZONE,
            5,
            Optional.empty(),
            Optional.empty(),
            false);
    var count = 0;
    for (var i = 0; i < snaps; i++) {
      var draws =
          model.draw(outcome, offense, TestPersonnel.baselineDefense(), Side.HOME, surface, rng);
      count += draws.size();
    }
    return count;
  }

  private List<InjuryDraw> sampleManyInjuries(int snaps, long seed) {
    var rng = new SeededRandomSource(seed);
    var carrier = playerWith(Position.RB, 0, 50, 50, 50, "rb");
    var offense = TestPersonnel.offenseWith(carrier);
    var outcome =
        new RunOutcome.Run(
            carrier.id(),
            app.zoneblitz.gamesimulator.event.RunConcept.INSIDE_ZONE,
            5,
            Optional.empty(),
            Optional.empty(),
            false);
    var all = new java.util.ArrayList<InjuryDraw>();
    for (var i = 0; i < snaps; i++) {
      all.addAll(
          model.draw(
              outcome, offense, TestPersonnel.baselineDefense(), Side.HOME, Surface.TURF, rng));
    }
    return all;
  }

  private static <K, T> java.util.Map<K, Integer> countBy(
      List<T> items, java.util.function.Function<T, K> keyFn) {
    var out = new java.util.HashMap<K, Integer>();
    for (var item : items) {
      out.merge(keyFn.apply(item), 1, Integer::sum);
    }
    return out;
  }

  /**
   * Builds a player with explicit toughness, agility, strength, and footballIq; remaining axes at
   * 50.
   */
  private static Player playerWith(
      Position pos, int toughness, int agility, int strength, int footballIq, String name) {
    return new Player(
        new PlayerId(UUID.randomUUID()),
        pos,
        name,
        new Physical(50, 50, agility, strength, 50, 50, 50, 50),
        Skill.average(),
        new Tendencies(50, 50, footballIq, 50, toughness, 50, 50, 50, 50));
  }

  private static Player playerWithAgility(Position pos, int agility, String name) {
    return playerWith(pos, 50, agility, 50, 50, name);
  }

  private static Player playerWithStrength(Position pos, int strength, String name) {
    return playerWith(pos, 50, 50, strength, 50, name);
  }

  private static Player playerWithFootballIq(Position pos, int footballIq, String name) {
    return playerWith(pos, 50, 50, 50, footballIq, name);
  }

  /**
   * Lightweight {@link RandomSource} for tests; deterministic from a seed and stateful so each draw
   * advances the stream.
   */
  private static final class SeededRandomSource implements RandomSource {
    private final Random random;

    SeededRandomSource(long seed) {
      this.random = new Random(seed);
    }

    @Override
    public long nextLong() {
      return random.nextLong();
    }

    @Override
    public double nextDouble() {
      return random.nextDouble();
    }

    @Override
    public double nextGaussian() {
      return random.nextGaussian();
    }

    @Override
    public RandomSource split(long key) {
      return this;
    }
  }
}
