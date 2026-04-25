package app.zoneblitz.gamesimulator.roster;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AttributeProfileTests {

  private static final AttributeMixtureComponent COMPONENT_A =
      new AttributeMixtureComponent(0.4, "a", Map.of(), Map.of(), Map.of());
  private static final AttributeMixtureComponent COMPONENT_B =
      new AttributeMixtureComponent(0.6, "b", Map.of(), Map.of(), Map.of());

  @Test
  void constructor_acceptsWeightsSummingToOne() {
    var profile = new AttributeProfile(Position.S, List.of(COMPONENT_A, COMPONENT_B));

    assertThat(profile.position()).isEqualTo(Position.S);
    assertThat(profile.components()).hasSize(2);
  }

  @Test
  void constructor_rejectsEmptyComponents() {
    assertThatThrownBy(() -> new AttributeProfile(Position.S, List.of()))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("components");
  }

  @Test
  void constructor_rejectsWeightsNotSummingToOne() {
    var c = new AttributeMixtureComponent(0.3, "drift", Map.of(), Map.of(), Map.of());
    assertThatThrownBy(() -> new AttributeProfile(Position.S, List.of(c)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("sum to 1.0");
  }

  @Test
  void constructor_acceptsSingleComponentWithWeightOne() {
    var c = new AttributeMixtureComponent(1.0, "solo", Map.of(), Map.of(), Map.of());
    var profile = new AttributeProfile(Position.K, List.of(c));

    assertThat(profile.components()).containsExactly(c);
  }
}
