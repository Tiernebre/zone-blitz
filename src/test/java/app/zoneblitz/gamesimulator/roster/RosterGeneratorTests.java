package app.zoneblitz.gamesimulator.roster;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import org.junit.jupiter.api.Test;

class RosterGeneratorTests {

  private final RosterGenerator generator =
      new RosterGenerator(new CholeskyPlayerGenerator(new ClasspathAttributeProfileRepository()));

  @Test
  void generate_producesDefaultRosterSize() {
    var roster = generator.generate(1L, new SplittableRandomSource(7L), rng -> "Player");

    assertThat(roster).hasSize(43);
  }

  @Test
  void generate_includesEveryPositionWithDefaultCounts() {
    var roster = generator.generate(2L, new SplittableRandomSource(7L), rng -> "Player");

    assertThat(roster).filteredOn(p -> p.position() == Position.QB).hasSize(2);
    assertThat(roster).filteredOn(p -> p.position() == Position.OL).hasSize(8);
    assertThat(roster).filteredOn(p -> p.position() == Position.DL).hasSize(6);
    assertThat(roster).filteredOn(p -> p.position() == Position.S).hasSize(3);
    assertThat(roster).filteredOn(p -> p.position() == Position.K).hasSize(1);
    assertThat(roster).filteredOn(p -> p.position() == Position.LS).hasSize(1);
  }

  @Test
  void generate_sameSeedProducesSameRoster() {
    var rosterA = generator.generate(99L, new SplittableRandomSource(42L), rng -> "Twin");
    var rosterB = generator.generate(99L, new SplittableRandomSource(42L), rng -> "Twin");

    assertThat(rosterA).isEqualTo(rosterB);
  }

  @Test
  void generate_safetyRosterHasMixOfBoxAndCoverageShapes() {
    var roster = generator.generate(123L, new SplittableRandomSource(31L), rng -> "S");
    var safeties = roster.stream().filter(p -> p.position() == Position.S).toList();

    var hasBoxLeaning =
        safeties.stream().anyMatch(p -> p.skill().tackling() > p.skill().coverageTechnique() + 5);
    var hasCoverageLeaning =
        safeties.stream().anyMatch(p -> p.skill().coverageTechnique() > p.skill().tackling() + 5);

    assertThat(hasBoxLeaning || hasCoverageLeaning).isTrue();
  }
}
