package app.zoneblitz.gamesimulator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import app.zoneblitz.gamesimulator.roster.CoachId;
import app.zoneblitz.gamesimulator.roster.CoachQuality;
import app.zoneblitz.gamesimulator.roster.CoachTendencies;
import app.zoneblitz.gamesimulator.roster.DefensiveCoachTendencies;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AggressionFourthDownPolicyTests {

  private final FourthDownPolicy policy = new AggressionFourthDownPolicy();

  @Test
  void decide_nonFourthDown_throws() {
    var state = TestGameStates.neutral(3, 5, 50);

    assertThatThrownBy(() -> policy.decide(state, coachWith(50, 0), new ConstantRandomSource(0.5)))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void decide_qualityZero_followsPureTendency() {
    // Midfield (yardLine 55), dist 2 → tendency baseline 0.35, aggression 50 shift = 0 → 0.35.
    var coach = coachWith(50, 0);
    var state = TestGameStates.neutral(4, 2, 55);

    assertThat(policy.decide(state, coach, new ConstantRandomSource(0.34)))
        .isEqualTo(FourthDownPolicy.Decision.GO_FOR_IT);
    assertThat(policy.decide(state, coach, new ConstantRandomSource(0.36)))
        .isEqualTo(FourthDownPolicy.Decision.PUNT);
  }

  @Test
  void decide_qualityOneHundred_followsEvTable() {
    // Same spot: EV table for midfield / short (2-3) is 0.70.
    var coach = coachWith(50, 100);
    var state = TestGameStates.neutral(4, 2, 55);

    assertThat(policy.decide(state, coach, new ConstantRandomSource(0.69)))
        .isEqualTo(FourthDownPolicy.Decision.GO_FOR_IT);
    assertThat(policy.decide(state, coach, new ConstantRandomSource(0.71)))
        .isEqualTo(FourthDownPolicy.Decision.PUNT);
  }

  @Test
  void decide_qualityFifty_blendsHalfway() {
    // Blend: (0.35 + 0.70) / 2 = 0.525.
    var coach = coachWith(50, 50);
    var state = TestGameStates.neutral(4, 2, 55);

    assertThat(policy.decide(state, coach, new ConstantRandomSource(0.52)))
        .isEqualTo(FourthDownPolicy.Decision.GO_FOR_IT);
    assertThat(policy.decide(state, coach, new ConstantRandomSource(0.53)))
        .isEqualTo(FourthDownPolicy.Decision.PUNT);
  }

  @Test
  void decide_highQualityAggressiveTendency_pullsTowardEvWhenEvIsLower() {
    // FG fringe (yardLine 75), dist 5: tendency 0.03 + aggression 100 shift (+0.15) = 0.18.
    // EV table: 0.15. At quality 100 → 0.15; at quality 0 → 0.18. Tight convergence; rng 0.5 → FG.
    var coach = coachWith(100, 100);
    var state = TestGameStates.neutral(4, 5, 75);

    assertThat(policy.decide(state, coach, new ConstantRandomSource(0.5)))
        .isEqualTo(FourthDownPolicy.Decision.ATTEMPT_FIELD_GOAL);
  }

  @Test
  void decide_ownTerritoryLongDistance_punts() {
    // Own 20, dist 10: tendency 0.02, EV 0.01. Always kick; < 63 → punt.
    var coach = coachWith(50, 100);
    var state = TestGameStates.neutral(4, 10, 20);

    assertThat(policy.decide(state, coach, new ConstantRandomSource(0.5)))
        .isEqualTo(FourthDownPolicy.Decision.PUNT);
  }

  private static Coach coachWith(int aggression, int decisionQuality) {
    var offense = new CoachTendencies(50, aggression, 50, 50, 50, 50, 50, 50, 50, 50);
    var quality = new CoachQuality(decisionQuality, 50);
    return new Coach(
        new CoachId(new UUID(9L, aggression * 1000L + decisionQuality)),
        "Agg-" + aggression + "-Q" + decisionQuality,
        offense,
        DefensiveCoachTendencies.average(),
        quality);
  }

  private static final class ConstantRandomSource implements RandomSource {
    private final double value;

    ConstantRandomSource(double value) {
      this.value = value;
    }

    @Override
    public long nextLong() {
      return 0L;
    }

    @Override
    public double nextDouble() {
      return value;
    }

    @Override
    public double nextGaussian() {
      return 0.0;
    }

    @Override
    public RandomSource split(long key) {
      return this;
    }
  }
}
