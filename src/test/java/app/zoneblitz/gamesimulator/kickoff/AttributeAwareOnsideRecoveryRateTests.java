package app.zoneblitz.gamesimulator.kickoff;

import static app.zoneblitz.gamesimulator.roster.PlayerBuilder.aPlayer;
import static app.zoneblitz.gamesimulator.roster.SkillBuilder.aSkill;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AttributeAwareOnsideRecoveryRateTests {

  private static final double BASELINE = 0.10;
  private static final OnsideRecoveryRate BASELINE_RATE = new FixedOnsideRecoveryRate(BASELINE);

  @Test
  void compute_whenAllAverage_returnsBaseline() {
    var rate = new AttributeAwareOnsideRecoveryRate(BASELINE_RATE);
    var kicking = teamWithHands(50, 50, 50);
    var receiving = teamWithHands(50, 50, 50);

    assertThat(rate.compute(kicking, receiving)).isEqualTo(BASELINE);
  }

  @Test
  void compute_whenKickingAttributesElite_shiftsRateUp() {
    var rate = new AttributeAwareOnsideRecoveryRate(BASELINE_RATE);
    var kicking = teamWithHands(100, 100, 100);
    var receiving = teamWithHands(50, 50, 50);

    assertThat(rate.compute(kicking, receiving)).isGreaterThan(BASELINE);
  }

  @Test
  void compute_whenReceivingHandsTeamElite_shiftsRateDown() {
    var rate = new AttributeAwareOnsideRecoveryRate(BASELINE_RATE);
    var kicking = teamWithHands(50, 50, 50);
    var receiving = teamWithHands(50, 100, 100);

    assertThat(rate.compute(kicking, receiving)).isLessThan(BASELINE);
  }

  @Test
  void compute_whenExtremeMismatchInKickingFavor_clampsAtMaxShift() {
    var rate = new AttributeAwareOnsideRecoveryRate(BASELINE_RATE);
    var kicking = teamWithHands(100, 100, 100);
    var receiving = teamWithHands(0, 0, 0);

    assertThat(rate.compute(kicking, receiving))
        .isCloseTo(BASELINE + AttributeAwareOnsideRecoveryRate.MAX_SHIFT, within(1e-9));
  }

  @Test
  void compute_whenExtremeMismatchInReceivingFavor_clampsAtMinShift() {
    var rate = new AttributeAwareOnsideRecoveryRate(BASELINE_RATE);
    var kicking = teamWithHands(0, 0, 0);
    var receiving = teamWithHands(100, 100, 100);

    assertThat(rate.compute(kicking, receiving))
        .isCloseTo(BASELINE - AttributeAwareOnsideRecoveryRate.MAX_SHIFT, within(1e-9));
  }

  @Test
  void compute_whenBaselineIsHigh_clampsAtOne() {
    var rate = new AttributeAwareOnsideRecoveryRate(new FixedOnsideRecoveryRate(0.99));
    var kicking = teamWithHands(100, 100, 100);
    var receiving = teamWithHands(0, 0, 0);

    assertThat(rate.compute(kicking, receiving)).isLessThanOrEqualTo(1.0);
  }

  @Test
  void compute_whenBaselineIsZero_clampsAtZero() {
    var rate = new AttributeAwareOnsideRecoveryRate(new FixedOnsideRecoveryRate(0.0));
    var kicking = teamWithHands(0, 0, 0);
    var receiving = teamWithHands(100, 100, 100);

    assertThat(rate.compute(kicking, receiving)).isGreaterThanOrEqualTo(0.0);
  }

  @Test
  void compute_whenKickerAccuracyHigher_shiftsRateUp() {
    var rate = new AttributeAwareOnsideRecoveryRate(BASELINE_RATE);
    var kickingPrecise = teamWithHands(100, 50, 50);
    var kickingPoor = teamWithHands(0, 50, 50);
    var receiving = teamWithHands(50, 50, 50);

    assertThat(rate.compute(kickingPrecise, receiving))
        .isGreaterThan(rate.compute(kickingPoor, receiving));
  }

  @Test
  void compute_whenKickingTeamHasNoKicker_treatsKickerAxisAsAverage() {
    var rate = new AttributeAwareOnsideRecoveryRate(BASELINE_RATE);
    var kicking =
        new Team(
            new TeamId(new UUID(7L, 0L)),
            "NoKicker",
            List.of(
                aPlayer()
                    .withId(new PlayerId(new UUID(7L, 1L)))
                    .atPosition(Position.LB)
                    .withSkill(aSkill().withBallSkills(50).withHands(50))
                    .build()));
    var receiving = teamWithHands(50, 50, 50);

    assertThat(rate.compute(kicking, receiving)).isEqualTo(BASELINE);
  }

  @Test
  void compute_whenAttributesShiftRate_excludesKickerAndPunterFromHandsTeamMean() {
    var rate = new AttributeAwareOnsideRecoveryRate(BASELINE_RATE);
    var kicking =
        teamBuilder("Kicking")
            .withSpecialist(Position.K, 50, 0, 0)
            .withSpecialist(Position.P, 50, 0, 0)
            .withFieldPlayer(Position.WR, 100, 100)
            .build();
    var kickingDilutedIfSpecialistsCounted =
        teamBuilder("Kicking")
            .withSpecialist(Position.K, 50, 100, 100)
            .withSpecialist(Position.P, 50, 100, 100)
            .withFieldPlayer(Position.WR, 100, 100)
            .build();
    var receiving = teamWithHands(50, 50, 50);

    assertThat(rate.compute(kicking, receiving))
        .isEqualTo(rate.compute(kickingDilutedIfSpecialistsCounted, receiving));
  }

  private static Team teamWithHands(int kickAccuracy, int ballSkills, int hands) {
    return teamBuilder("Team")
        .withSpecialist(Position.K, kickAccuracy, 50, 50)
        .withFieldPlayer(Position.WR, ballSkills, hands)
        .withFieldPlayer(Position.S, ballSkills, hands)
        .build();
  }

  private static TestTeamBuilder teamBuilder(String name) {
    return new TestTeamBuilder(name);
  }

  private static final class TestTeamBuilder {
    private final String name;
    private final List<Player> roster = new ArrayList<>();
    private int counter = 1;

    TestTeamBuilder(String name) {
      this.name = name;
    }

    TestTeamBuilder withSpecialist(Position position, int kickAccuracy, int ballSkills, int hands) {
      roster.add(
          aPlayer()
              .withId(new PlayerId(new UUID(name.hashCode(), counter++)))
              .atPosition(position)
              .withSkill(
                  aSkill()
                      .withKickAccuracy(kickAccuracy)
                      .withBallSkills(ballSkills)
                      .withHands(hands))
              .build());
      return this;
    }

    TestTeamBuilder withFieldPlayer(Position position, int ballSkills, int hands) {
      roster.add(
          aPlayer()
              .withId(new PlayerId(new UUID(name.hashCode(), counter++)))
              .atPosition(position)
              .withSkill(aSkill().withBallSkills(ballSkills).withHands(hands))
              .build());
      return this;
    }

    Team build() {
      return new Team(new TeamId(new UUID(name.hashCode(), 0L)), name, List.copyOf(roster));
    }
  }
}
