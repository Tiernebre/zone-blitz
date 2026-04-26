package app.zoneblitz.gamesimulator.punt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.roster.Physical;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Skill;
import app.zoneblitz.gamesimulator.roster.Tendencies;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PuntAttributeWeightsTests {

  private static final java.util.function.ToDoubleFunction<Skill> POWER = s -> s.puntPower();

  @Test
  void construct_physicalWeightsNot100_throws() {
    assertThatThrownBy(() -> new PuntAttributeWeights(0, 0, 0, 0, 0, 0, 0, 0, POWER))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("sum to 100");
  }

  @Test
  void construct_nullSkillAggregate_throws() {
    assertThatThrownBy(() -> new PuntAttributeWeights(0, 0, 5, 10, 60, 0, 0, 25, null))
        .isInstanceOf(NullPointerException.class);
  }

  @Test
  void physicalScore_averagePlayer_isZero() {
    var w = new PuntAttributeWeights(0, 0, 5, 10, 60, 0, 0, 25, POWER);

    assertThat(w.physicalScore(Physical.average())).isZero();
  }

  @Test
  void skillScore_routesThroughAggregateFunction() {
    var w = new PuntAttributeWeights(0, 0, 5, 10, 60, 0, 0, 25, POWER);
    var elite =
        new Player(
            new PlayerId(new UUID(0L, 1L)),
            Position.P,
            "P",
            Physical.average(),
            new Skill(
                50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 100, 50, 50, 50, 50, 50, 50, 50, 50,
                50, 50, 50, 50, 50, 50, 50, 50),
            Tendencies.average());

    assertThat(w.skillScore(elite)).isEqualTo(1.0);
  }
}
