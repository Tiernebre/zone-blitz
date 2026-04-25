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

class BaselineInjuryModelTests {

  private final InjuryModel model = new BaselineInjuryModel();

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
    var weakRb = playerWithToughness(Position.RB, 0, "weak-rb");
    var strongRb = playerWithToughness(Position.RB, 100, "strong-rb");
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

  private int countInjuriesOnSurface(Surface surface, int snaps, long seed) {
    var rng = new SeededRandomSource(seed);
    var carrier = playerWithToughness(Position.RB, 50, "rb");
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
    var carrier = playerWithToughness(Position.RB, 0, "rb");
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

  private static Player playerWithToughness(Position pos, int toughness, String name) {
    return new Player(
        new PlayerId(UUID.randomUUID()),
        pos,
        name,
        Physical.average(),
        Skill.average(),
        new Tendencies(50, 50, 50, 50, toughness, 50, 50, 50));
  }

  private static PlayerId pickFirstDefenderId() {
    return TestPersonnel.baselineDefense().players().get(0).id();
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
