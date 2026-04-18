package app.zoneblitz.names;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class CuratedNameGeneratorTests {

  @Test
  void generate_drawsFirstAndLastFromPools() {
    NameGenerator generator =
        new CuratedNameGenerator(List.of("Marcus", "Elijah"), List.of("Alvarez", "Nguyen"));

    var name = generator.generate(new SplittableRandomSource(42L));

    assertThat(name.first()).isIn("Marcus", "Elijah");
    assertThat(name.last()).isIn("Alvarez", "Nguyen");
    assertThat(name.display()).isEqualTo(name.first() + " " + name.last());
  }

  @Test
  void generate_isDeterministicForSameSeed() {
    NameGenerator generator = CuratedNameGenerator.maleDefaults();

    var first = drawMany(generator, 20L, 10);
    var second = drawMany(generator, 20L, 10);

    assertThat(first).isEqualTo(second);
  }

  @Test
  void generate_producesVariedDrawsAcrossLargeSample() {
    NameGenerator generator = CuratedNameGenerator.maleDefaults();
    var rng = new SplittableRandomSource(7L);

    var names = IntStream.range(0, 200).mapToObj(i -> generator.generate(rng)).toList();

    assertThat(names.stream().map(Name::first).distinct().count()).isGreaterThan(50);
    assertThat(names.stream().map(Name::last).distinct().count()).isGreaterThan(50);
  }

  @Test
  void maleDefaults_loadsBundledPools() {
    var generator = CuratedNameGenerator.maleDefaults();

    var name = generator.generate(new SplittableRandomSource(1L));

    assertThat(name.first()).isNotBlank();
    assertThat(name.last()).isNotBlank();
  }

  @Test
  void constructor_rejectsEmptyPools() {
    assertThatThrownBy(() -> new CuratedNameGenerator(List.of(), List.of("Smith")))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new CuratedNameGenerator(List.of("Marcus"), List.of()))
        .isInstanceOf(IllegalArgumentException.class);
  }

  private static List<Name> drawMany(NameGenerator generator, long seed, int count) {
    RandomSource rng = new SplittableRandomSource(seed);
    return IntStream.range(0, count).mapToObj(i -> generator.generate(rng)).toList();
  }
}
