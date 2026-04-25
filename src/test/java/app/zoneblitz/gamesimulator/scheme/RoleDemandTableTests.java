package app.zoneblitz.gamesimulator.scheme;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.role.DefensiveRole;
import app.zoneblitz.gamesimulator.role.OffensiveRole;
import app.zoneblitz.gamesimulator.role.PhysicalAxis;
import app.zoneblitz.gamesimulator.role.Role;
import app.zoneblitz.gamesimulator.role.RoleDemand;
import app.zoneblitz.gamesimulator.role.SkillAxis;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RoleDemandTableTests {

  private static final RoleDemand BASELINE_X_WR =
      RoleDemand.of(
          Map.of(PhysicalAxis.SPEED, 60, PhysicalAxis.AGILITY, 40),
          Map.of(SkillAxis.ROUTE_RUNNING, 70, SkillAxis.HANDS, 30));

  private static final RoleDemand SCREEN_X_WR =
      RoleDemand.of(
          Map.of(PhysicalAxis.AGILITY, 60, PhysicalAxis.ACCELERATION, 40),
          Map.of(SkillAxis.HANDS, 70, SkillAxis.ROUTE_RUNNING, 30));

  @Test
  void lookup_returnsRoleDefaultWhenNoOverride() {
    var table = RoleDemandTable.ofDefaults(Map.of(OffensiveRole.X_WR, BASELINE_X_WR));

    assertThat(table.lookup(OffensiveRole.X_WR, PassConcept.DROPBACK)).isEqualTo(BASELINE_X_WR);
  }

  @Test
  void lookup_returnsOverrideWhenPresent() {
    var defaults = Map.<Role, RoleDemand>of(OffensiveRole.X_WR, BASELINE_X_WR);
    var overrides = Map.of(new RoleDemandKey(OffensiveRole.X_WR, PassConcept.SCREEN), SCREEN_X_WR);
    var table = new RoleDemandTable(defaults, overrides);

    assertThat(table.lookup(OffensiveRole.X_WR, PassConcept.SCREEN)).isEqualTo(SCREEN_X_WR);
    assertThat(table.lookup(OffensiveRole.X_WR, PassConcept.DROPBACK)).isEqualTo(BASELINE_X_WR);
  }

  @Test
  void lookup_throwsWhenNeitherOverrideNorDefault() {
    var table = RoleDemandTable.ofDefaults(Map.of());

    assertThatThrownBy(() -> table.lookup(DefensiveRole.NOSE, RunConcept.POWER))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("NOSE");
  }

  @Test
  void constructor_defensivelyCopiesMaps() {
    var defaults = new java.util.HashMap<Role, RoleDemand>();
    defaults.put(OffensiveRole.X_WR, BASELINE_X_WR);
    var table = new RoleDemandTable(defaults, Map.of());

    defaults.clear();

    assertThat(table.lookup(OffensiveRole.X_WR, PassConcept.DROPBACK)).isEqualTo(BASELINE_X_WR);
  }
}
