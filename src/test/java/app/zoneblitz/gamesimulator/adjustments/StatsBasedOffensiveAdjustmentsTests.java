package app.zoneblitz.gamesimulator.adjustments;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.roster.CoachTendencies;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class StatsBasedOffensiveAdjustmentsTests {

  private OffensiveAdjustmentSource source;
  private CoachTendencies oc;

  @BeforeEach
  void setUp() {
    source = new StatsBasedOffensiveAdjustments();
    oc = CoachTendencies.average();
  }

  @Test
  void compute_emptyLog_returnsNeutral() {
    var adj = source.compute(TeamPlayLog.empty(), oc);

    assertThat(adj).isEqualTo(OffensiveAdjustments.NEUTRAL);
  }

  @Test
  void compute_belowSampleFloor_returnsNeutral() {
    var smallSample = new TeamPlayLog(2, 14, 1, 0, 0, 2, 6, 0, 0, 0, 0, List.of());

    var adj = source.compute(smallSample, oc);

    assertThat(adj).isEqualTo(OffensiveAdjustments.NEUTRAL);
  }

  @Test
  void compute_highSackRate_pivotToScreensAndShotgun() {
    var blitzed = new TeamPlayLog(7, 40, 4, 3, 0, 0, 0, 0, 0, 0, 0, List.of());

    var adj = source.compute(blitzed, oc);

    assertThat(adj.passConceptMultiplier(PassConcept.SCREEN))
        .isEqualTo(StatsBasedOffensiveAdjustments.BLITZED_SCREEN_MULT);
    assertThat(adj.passConceptMultiplier(PassConcept.QUICK_GAME))
        .isEqualTo(StatsBasedOffensiveAdjustments.BLITZED_QUICK_GAME_MULT);
    assertThat(adj.passConceptMultiplier(PassConcept.HAIL_MARY))
        .isEqualTo(StatsBasedOffensiveAdjustments.BLITZED_HAIL_MARY_MULT);
    assertThat(adj.shotgunLogitShift())
        .isEqualTo(StatsBasedOffensiveAdjustments.BLITZED_SHOTGUN_LOGIT_SHIFT);
  }

  @Test
  void compute_highStuffRate_pivotToPlayActionAwayFromInsideZone() {
    var stuffed = new TeamPlayLog(0, 0, 0, 0, 0, 10, 12, 5, 0, 0, 0, List.of());

    var adj = source.compute(stuffed, oc);

    assertThat(adj.passConceptMultiplier(PassConcept.PLAY_ACTION))
        .isEqualTo(StatsBasedOffensiveAdjustments.STUFFED_PLAY_ACTION_MULT);
    assertThat(adj.runConceptMultiplier(RunConcept.INSIDE_ZONE))
        .isEqualTo(StatsBasedOffensiveAdjustments.STUFFED_INSIDE_ZONE_MULT);
    assertThat(adj.passRateLogitShift())
        .isEqualTo(StatsBasedOffensiveAdjustments.STUFFED_PASS_RATE_LOGIT_SHIFT);
  }

  @Test
  void compute_neutralEfficiency_returnsZeroShifts() {
    var neutral = new TeamPlayLog(8, 56, 5, 0, 0, 8, 32, 1, 0, 0, 0, List.of());

    var adj = source.compute(neutral, oc);

    assertThat(adj.passRateLogitShift()).isZero();
    assertThat(adj.shotgunLogitShift()).isZero();
    assertThat(adj.passConceptMultipliers()).isEmpty();
    assertThat(adj.runConceptMultipliers()).isEmpty();
  }

  @Test
  void compute_blitzedAndStuffed_combinesShiftsAdditively() {
    var both = new TeamPlayLog(7, 40, 4, 3, 0, 10, 12, 5, 0, 0, 0, List.of());

    var adj = source.compute(both, oc);

    var expectedPassRate =
        StatsBasedOffensiveAdjustments.BLITZED_PASS_RATE_LOGIT_SHIFT
            + StatsBasedOffensiveAdjustments.STUFFED_PASS_RATE_LOGIT_SHIFT;
    assertThat(adj.passRateLogitShift()).isEqualTo(expectedPassRate);
  }

  @Test
  void compute_stubbornCoach_dampensBlitzedShifts() {
    var blitzed = new TeamPlayLog(7, 40, 4, 3, 0, 0, 0, 0, 0, 0, 0, List.of());
    var stubborn = new CoachTendencies(50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 0);

    var adj = source.compute(blitzed, stubborn);

    assertThat(adj.shotgunLogitShift())
        .isEqualTo(
            StatsBasedOffensiveAdjustments.BLITZED_SHOTGUN_LOGIT_SHIFT
                * AdaptabilityGate.STUBBORN_FACTOR);
    var screenMultDelta = StatsBasedOffensiveAdjustments.BLITZED_SCREEN_MULT - 1.0;
    assertThat(adj.passConceptMultiplier(app.zoneblitz.gamesimulator.event.PassConcept.SCREEN))
        .isEqualTo(1.0 + screenMultDelta * AdaptabilityGate.STUBBORN_FACTOR);
  }
}
