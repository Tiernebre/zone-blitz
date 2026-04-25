package app.zoneblitz.gamesimulator.roster;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.gamesimulator.role.PhysicalAxis;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AttributeMixtureComponentTests {

  @Test
  void constructor_acceptsEmptyMaps() {
    var c = new AttributeMixtureComponent(0.5, "test", Map.of(), Map.of(), Map.of());

    assertThat(c.weight()).isEqualTo(0.5);
    assertThat(c.means()).isEmpty();
  }

  @Test
  void constructor_rejectsNegativeWeight() {
    assertThatThrownBy(
            () -> new AttributeMixtureComponent(-0.1, "test", Map.of(), Map.of(), Map.of()))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("weight");
  }

  @Test
  void constructor_rejectsMeanOutsideZeroHundred() {
    assertThatThrownBy(
            () ->
                new AttributeMixtureComponent(
                    0.5, "test", Map.of(PhysicalAxis.SPEED, 150.0), Map.of(), Map.of()))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("means");
  }

  @Test
  void constructor_rejectsNegativeStddev() {
    assertThatThrownBy(
            () ->
                new AttributeMixtureComponent(
                    0.5, "test", Map.of(), Map.of(PhysicalAxis.SPEED, -1.0), Map.of()))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("stddevs");
  }

  @Test
  void constructor_rejectsCorrelationOutsideMinusOneOne() {
    var pair = AxisPair.of(PhysicalAxis.SPEED, PhysicalAxis.AGILITY);
    assertThatThrownBy(
            () -> new AttributeMixtureComponent(0.5, "test", Map.of(), Map.of(), Map.of(pair, 1.5)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("correlation");
  }
}
