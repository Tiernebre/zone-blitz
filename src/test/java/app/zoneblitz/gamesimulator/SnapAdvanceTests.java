package app.zoneblitz.gamesimulator;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.FumbleOutcome;
import app.zoneblitz.gamesimulator.event.IncompleteReason;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.resolver.RunOutcome;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SnapAdvanceTests {

  private static final PlayerId P = new PlayerId(new UUID(0L, 1L));
  private static final PlayerId Q = new PlayerId(new UUID(0L, 2L));

  @Test
  void derive_runCrossingGoalLine_clampsYardsAndFlagsTouchdown() {
    var run =
        new RunOutcome.Run(
            P, RunConcept.INSIDE_ZONE, 90, Optional.empty(), Optional.empty(), false);

    var advance = SnapAdvance.derive(run, 99);

    assertThat(advance.touchdown()).isTrue();
    assertThat(advance.offensiveYards()).isEqualTo(1);
    assertThat(advance.endYardLine()).isEqualTo(100);
    assertThat(advance.safety()).isFalse();
    assertThat(advance.turnover()).isEqualTo(SnapAdvance.Turnover.NONE);
  }

  @Test
  void derive_runEndingShort_reportsRawYardsNoTouchdown() {
    var run =
        new RunOutcome.Run(P, RunConcept.INSIDE_ZONE, 5, Optional.empty(), Optional.empty(), false);

    var advance = SnapAdvance.derive(run, 50);

    assertThat(advance.touchdown()).isFalse();
    assertThat(advance.offensiveYards()).isEqualTo(5);
    assertThat(advance.endYardLine()).isEqualTo(55);
  }

  @Test
  void derive_sackInOwnEndZone_flagsSafety() {
    var sack = new PassOutcome.Sack(P, List.of(Q), 5, Optional.empty());

    var advance = SnapAdvance.derive(sack, 3);

    assertThat(advance.safety()).isTrue();
    assertThat(advance.endYardLine()).isZero();
    assertThat(advance.offensiveYards()).isEqualTo(-3);
  }

  @Test
  void derive_passCompleteExactlyAtGoalLine_touchdown() {
    var pc = new PassOutcome.PassComplete(P, Q, 20, 0, 20, Optional.empty(), List.of(), false);

    var advance = SnapAdvance.derive(pc, 80);

    assertThat(advance.touchdown()).isTrue();
    assertThat(advance.offensiveYards()).isEqualTo(20);
    assertThat(advance.endYardLine()).isEqualTo(100);
  }

  @Test
  void derive_incompletePass_noAdvance() {
    var incomplete =
        new PassOutcome.PassIncomplete(P, Q, 10, IncompleteReason.DROPPED, Optional.empty());

    var advance = SnapAdvance.derive(incomplete, 40);

    assertThat(advance.endYardLine()).isEqualTo(40);
    assertThat(advance.offensiveYards()).isZero();
    assertThat(advance.touchdown()).isFalse();
    assertThat(advance.safety()).isFalse();
  }

  @Test
  void derive_interceptionReturnedFullField_flagsPickSix() {
    var intercept = new PassOutcome.Interception(P, Q, P, 60);

    var advance = SnapAdvance.derive(intercept, 60);

    assertThat(advance.turnover()).isEqualTo(SnapAdvance.Turnover.INTERCEPTION);
    assertThat(advance.defensiveTouchdown()).isTrue();
    assertThat(advance.endYardLine()).isEqualTo(100);
  }

  @Test
  void derive_interceptionShortReturn_flipsPossessionNoScore() {
    var intercept = new PassOutcome.Interception(P, Q, P, 5);

    var advance = SnapAdvance.derive(intercept, 40);

    assertThat(advance.turnover()).isEqualTo(SnapAdvance.Turnover.INTERCEPTION);
    assertThat(advance.defensiveTouchdown()).isFalse();
    // New offense perspective: 100 - 40 + 5 = 65 yards from their own goal.
    assertThat(advance.endYardLine()).isEqualTo(65);
  }

  @Test
  void derive_runFumbleLostReturnedForTouchdown_flagsDefensiveTd() {
    var fumble = new FumbleOutcome(P, true, Optional.of(Q), 50);
    var run =
        new RunOutcome.Run(
            P, RunConcept.INSIDE_ZONE, 2, Optional.empty(), Optional.of(fumble), false);

    var advance = SnapAdvance.derive(run, 40);

    assertThat(advance.turnover()).isEqualTo(SnapAdvance.Turnover.FUMBLE_LOST);
    assertThat(advance.defensiveTouchdown()).isTrue();
    assertThat(advance.endYardLine()).isEqualTo(100);
  }
}
