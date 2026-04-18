package app.zoneblitz.gamesimulator.resolver.run;

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

class RunAttributeWeightsTests {

  private static final java.util.function.ToDoubleFunction<Skill> RUN_BLOCK_SKILL =
      s -> s.runBlock();

  @Test
  void construct_physicalWeightsNot100_throws() {
    assertThatThrownBy(
            () -> new RunAttributeWeights(10, 10, 10, 10, 10, 10, 10, 10, RUN_BLOCK_SKILL))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("sum to 100");
  }

  @Test
  void construct_physicalWeights100_ok() {
    var w = new RunAttributeWeights(0, 0, 20, 30, 30, 0, 20, 0, RUN_BLOCK_SKILL);
    assertThat(w).isNotNull();
  }

  @Test
  void construct_nullSkillAggregate_throws() {
    assertThatThrownBy(() -> new RunAttributeWeights(100, 0, 0, 0, 0, 0, 0, 0, null))
        .isInstanceOf(NullPointerException.class);
  }

  @Test
  void physicalScore_averagePlayer_isZero() {
    var w = new RunAttributeWeights(20, 0, 20, 25, 20, 0, 0, 15, RUN_BLOCK_SKILL);

    assertThat(w.physicalScore(Physical.average())).isZero();
  }

  @Test
  void physicalScore_allHundredPlayer_isPlusOne() {
    var w = new RunAttributeWeights(20, 0, 20, 25, 20, 0, 0, 15, RUN_BLOCK_SKILL);
    var elite = new Physical(100, 100, 100, 100, 100, 100, 100, 100);

    assertThat(w.physicalScore(elite)).isEqualTo(1.0);
  }

  @Test
  void physicalScore_weightsDrivenByWeightedAxesOnly() {
    // All 100 weight on strength; every other axis ignored regardless of value.
    var strengthOnly = new RunAttributeWeights(0, 0, 0, 100, 0, 0, 0, 0, RUN_BLOCK_SKILL);
    var fastButWeak = new Physical(100, 100, 100, 0, 0, 100, 100, 100);

    assertThat(strengthOnly.physicalScore(fastButWeak))
        .as("strength=0 should center to -1 when strength has all the weight")
        .isEqualTo(-1.0);
  }

  @Test
  void skillScore_routesThroughAggregateFunction() {
    var w =
        new RunAttributeWeights(
            100, 0, 0, 0, 0, 0, 0, 0, s -> (s.ballCarrierVision() + s.breakTackle()) / 2.0);
    var elite =
        new Player(
            new PlayerId(new UUID(0L, 1L)),
            Position.RB,
            "RB",
            Physical.average(),
            new Skill(50, 50, 50, 50, 50, 50, 50, 100, 100, 50),
            Tendencies.average());

    assertThat(w.skillScore(elite)).isEqualTo(1.0);
  }
}
