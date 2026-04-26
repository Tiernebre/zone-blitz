package app.zoneblitz.gamesimulator.adjustments;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.roster.DefensiveCoachTendencies;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class StatsBasedDefensiveAdjustmentsTests {

  private DefensiveAdjustmentSource source;
  private DefensiveCoachTendencies dc;

  @BeforeEach
  void setUp() {
    source = new StatsBasedDefensiveAdjustments();
    dc = DefensiveCoachTendencies.average();
  }

  @Test
  void compute_emptyLog_returnsNeutral() {
    var adj = source.compute(TeamPlayLog.empty(), dc);

    assertThat(adj).isEqualTo(DefensiveAdjustments.NEUTRAL);
  }

  @Test
  void compute_belowSampleFloor_returnsNeutral() {
    var smallSample = new TeamPlayLog(2, 30, 2, 0, 0, 2, 20, 0, 0, 0, 0, List.of());

    var adj = source.compute(smallSample, dc);

    assertThat(adj).isEqualTo(DefensiveAdjustments.NEUTRAL);
  }

  @Test
  void compute_runHumming_increasesBlitzAndBoxLoading() {
    var hotRun = new TeamPlayLog(0, 0, 0, 0, 0, 10, 70, 0, 0, 0, 0, List.of());

    var adj = source.compute(hotRun, dc);

    assertThat(adj.blitzLogitShift())
        .isEqualTo(StatsBasedDefensiveAdjustments.RUN_HUMMING_BLITZ_SHIFT);
    assertThat(adj.boxLoadingShift())
        .isEqualTo(StatsBasedDefensiveAdjustments.RUN_HUMMING_BOX_LOADING);
    assertThat(adj.singleHighShellMultiplier())
        .isEqualTo(StatsBasedDefensiveAdjustments.RUN_HUMMING_SINGLE_HIGH_MULT);
  }

  @Test
  void compute_passHumming_increasesBlitzAndBiasesTwoHigh() {
    var hotPass = new TeamPlayLog(10, 90, 7, 0, 0, 0, 0, 0, 0, 0, 0, List.of());

    var adj = source.compute(hotPass, dc);

    assertThat(adj.blitzLogitShift())
        .isEqualTo(StatsBasedDefensiveAdjustments.PASS_HUMMING_BLITZ_SHIFT);
    assertThat(adj.singleHighShellMultiplier())
        .isEqualTo(StatsBasedDefensiveAdjustments.PASS_HUMMING_TWO_HIGH_MULT);
  }

  @Test
  void compute_explosiveOffense_dampenBlitzAndAmplifiesTwoHigh() {
    var explosive = new TeamPlayLog(10, 60, 6, 0, 0, 0, 0, 0, 5, 0, 0, List.of());

    var adj = source.compute(explosive, dc);

    assertThat(adj.blitzLogitShift())
        .isEqualTo(StatsBasedDefensiveAdjustments.EXPLOSIVE_BLITZ_DAMPEN);
    assertThat(adj.singleHighShellMultiplier())
        .isEqualTo(StatsBasedDefensiveAdjustments.EXPLOSIVE_TWO_HIGH_MULT);
  }

  @Test
  void compute_screenHeavyRecentWindow_dampenScreenMultiplier() {
    var recent = new ArrayList<PlayKind>();
    Collections.addAll(recent, PlayKind.PASS_SCREEN, PlayKind.PASS_SCREEN, PlayKind.PASS_SCREEN);
    Collections.addAll(recent, PlayKind.PASS_SCREEN, PlayKind.RUN, PlayKind.RUN);
    var screenHeavy = new TeamPlayLog(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, List.copyOf(recent));

    var adj = source.compute(screenHeavy, dc);

    assertThat(adj.conceptMultiplier(PassConcept.SCREEN))
        .isEqualTo(StatsBasedDefensiveAdjustments.SCREEN_COUNTER_MULT);
  }

  @Test
  void compute_neutralEfficiency_returnsNeutralButRecognizesSample() {
    var neutralLog = new TeamPlayLog(10, 60, 6, 0, 0, 10, 40, 1, 1, 0, 0, List.of());

    var adj = source.compute(neutralLog, dc);

    assertThat(adj.blitzLogitShift()).isZero();
    assertThat(adj.singleHighShellMultiplier()).isEqualTo(1.0);
    assertThat(adj.boxLoadingShift()).isZero();
  }

  @Test
  void compute_stubbornCoach_dampensRunHummingShifts() {
    var hotRun = new TeamPlayLog(0, 0, 0, 0, 0, 10, 70, 0, 0, 0, 0, List.of());
    var stubborn = new DefensiveCoachTendencies(50, 50, 50, 50, 50, 50, 50, 50, 0);

    var adj = source.compute(hotRun, stubborn);

    assertThat(adj.blitzLogitShift())
        .isEqualTo(
            StatsBasedDefensiveAdjustments.RUN_HUMMING_BLITZ_SHIFT
                * AdaptabilityGate.STUBBORN_FACTOR);
    assertThat(adj.boxLoadingShift())
        .isEqualTo(
            StatsBasedDefensiveAdjustments.RUN_HUMMING_BOX_LOADING
                * AdaptabilityGate.STUBBORN_FACTOR);
  }

  @Test
  void compute_reactiveCoach_amplifiesShifts() {
    var hotRun = new TeamPlayLog(0, 0, 0, 0, 0, 10, 70, 0, 0, 0, 0, List.of());
    var reactive = new DefensiveCoachTendencies(50, 50, 50, 50, 50, 50, 50, 50, 100);

    var adj = source.compute(hotRun, reactive);

    assertThat(adj.blitzLogitShift())
        .isGreaterThan(StatsBasedDefensiveAdjustments.RUN_HUMMING_BLITZ_SHIFT);
  }
}
