package app.zoneblitz.gamesimulator.role;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.roster.Physical;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Skill;
import app.zoneblitz.gamesimulator.roster.Tendencies;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RoleDemandTests {

  private static final PlayerId ID = new PlayerId(new UUID(1L, 1L));

  @Test
  void constructor_acceptsEmptyFamilyMaps() {
    var demand = new RoleDemand(Map.of(), Map.of(), Map.of());

    assertThat(demand.physicalWeights()).isEmpty();
    assertThat(demand.skillWeights()).isEmpty();
    assertThat(demand.tendencyWeights()).isEmpty();
  }

  @Test
  void constructor_rejectsWeightsThatDoNotSumToHundred() {
    assertThatThrownBy(
            () ->
                new RoleDemand(
                    Map.of(PhysicalAxis.SPEED, 60, PhysicalAxis.AGILITY, 30), Map.of(), Map.of()))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("physicalWeights")
        .hasMessageContaining("100");
  }

  @Test
  void constructor_rejectsNegativeWeight() {
    assertThatThrownBy(
            () ->
                new RoleDemand(
                    Map.of(PhysicalAxis.SPEED, 110, PhysicalAxis.AGILITY, -10), Map.of(), Map.of()))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("non-negative");
  }

  @Test
  void physicalScore_returnsZeroForEmptyFamily() {
    var demand = new RoleDemand(Map.of(), Map.of(), Map.of());

    assertThat(demand.physicalScore(player(50, 0))).isZero();
  }

  @Test
  void physicalScore_centersAroundZeroAtAverageInputs() {
    var demand =
        RoleDemand.of(Map.of(PhysicalAxis.SPEED, 100), Map.of(SkillAxis.ROUTE_RUNNING, 100));
    var avgPlayer = player(50, 50);

    assertThat(demand.physicalScore(avgPlayer)).isZero();
    assertThat(demand.skillScore(avgPlayer)).isZero();
  }

  @Test
  void physicalScore_returnsPositiveOneForMaxedSingleAxis() {
    var demand = new RoleDemand(Map.of(PhysicalAxis.SPEED, 100), Map.of(), Map.of());

    assertThat(demand.physicalScore(player(100, 0))).isEqualTo(1.0);
  }

  @Test
  void physicalScore_returnsNegativeOneForFloorSingleAxis() {
    var demand = new RoleDemand(Map.of(PhysicalAxis.SPEED, 100), Map.of(), Map.of());

    assertThat(demand.physicalScore(player(0, 0))).isEqualTo(-1.0);
  }

  @Test
  void skillScore_appliesWeightedAverageAcrossAxes() {
    var demand = RoleDemand.of(Map.of(), Map.of(SkillAxis.ROUTE_RUNNING, 60, SkillAxis.HANDS, 40));
    var p =
        new Player(
            ID,
            Position.WR,
            "Test",
            Physical.average(),
            new Skill(50, 100, 50, 50, 50, 0, 50, 50, 50, 50, 50, 50, 50, 50, 50),
            Tendencies.average());

    assertThat(demand.skillScore(p)).isEqualTo((60 - 50) / 50.0);
  }

  @Test
  void constructor_defensivelyCopiesWeightMaps() {
    var phys = new java.util.HashMap<PhysicalAxis, Integer>();
    phys.put(PhysicalAxis.SPEED, 100);
    var demand = new RoleDemand(phys, Map.of(), Map.of());

    phys.put(PhysicalAxis.AGILITY, 999);

    assertThat(demand.physicalWeights()).containsExactly(Map.entry(PhysicalAxis.SPEED, 100));
  }

  private static Player player(int physicalAxes, int skillAxes) {
    var phys =
        new Physical(
            physicalAxes,
            physicalAxes,
            physicalAxes,
            physicalAxes,
            physicalAxes,
            physicalAxes,
            physicalAxes,
            physicalAxes);
    var skill =
        new Skill(
            skillAxes, skillAxes, skillAxes, skillAxes, skillAxes, skillAxes, skillAxes, skillAxes,
            skillAxes, skillAxes, skillAxes, skillAxes, skillAxes, skillAxes, skillAxes);
    return new Player(ID, Position.WR, "Test", phys, skill, Tendencies.average());
  }
}
