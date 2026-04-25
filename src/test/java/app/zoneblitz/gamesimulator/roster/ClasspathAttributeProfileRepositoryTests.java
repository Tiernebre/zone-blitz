package app.zoneblitz.gamesimulator.roster;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class ClasspathAttributeProfileRepositoryTests {

  private final ClasspathAttributeProfileRepository repository =
      new ClasspathAttributeProfileRepository();

  @ParameterizedTest
  @EnumSource(Position.class)
  void loadFor_loadsEveryPositionWithoutError(Position position) {
    var profile = repository.loadFor(position);

    assertThat(profile.position()).isEqualTo(position);
    assertThat(profile.components()).isNotEmpty();
  }

  @Test
  void loadFor_safetyHasTwoComponents() {
    var profile = repository.loadFor(Position.S);

    assertThat(profile.components()).hasSize(2);
  }

  @Test
  void loadFor_kickerIsSingleComponent() {
    var profile = repository.loadFor(Position.K);

    assertThat(profile.components()).hasSize(1);
    assertThat(profile.components().get(0).weight()).isEqualTo(1.0);
  }
}
