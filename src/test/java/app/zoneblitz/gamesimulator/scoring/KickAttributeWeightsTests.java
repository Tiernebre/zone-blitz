package app.zoneblitz.gamesimulator.scoring;

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

class KickAttributeWeightsTests {

  private static final java.util.function.ToDoubleFunction<Skill> ACCURACY = s -> s.kickAccuracy();

  @Test
  void construct_physicalWeightsNot100_throws() {
    assertThatThrownBy(() -> new KickAttributeWeights(10, 10, 10, 10, 10, 10, 10, 10, ACCURACY))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("sum to 100");
  }

  @Test
  void construct_nullSkillAggregate_throws() {
    assertThatThrownBy(() -> new KickAttributeWeights(0, 0, 0, 10, 60, 0, 0, 30, null))
        .isInstanceOf(NullPointerException.class);
  }

  @Test
  void physicalScore_averagePlayer_isZero() {
    var w = new KickAttributeWeights(0, 0, 0, 10, 60, 0, 0, 30, ACCURACY);

    assertThat(w.physicalScore(Physical.average())).isZero();
  }

  @Test
  void skillScore_routesThroughAggregateFunction() {
    var w = new KickAttributeWeights(0, 0, 0, 10, 60, 0, 0, 30, ACCURACY);
    var elite =
        new Player(
            new PlayerId(new UUID(0L, 1L)),
            Position.K,
            "K",
            Physical.average(),
            new Skill(
                50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 100, 50, 50, 50, 50, 50, 50, 50, 50, 50,
                50, 50, 50, 50, 50, 50, 50, 50),
            Tendencies.average());

    assertThat(w.skillScore(elite)).isEqualTo(1.0);
  }
}
