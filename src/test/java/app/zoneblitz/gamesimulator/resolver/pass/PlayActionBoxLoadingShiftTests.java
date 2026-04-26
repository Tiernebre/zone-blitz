package app.zoneblitz.gamesimulator.resolver.pass;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.formation.CoverageShell;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.resolver.MatchupContextDefaults;
import app.zoneblitz.gamesimulator.resolver.PassRoles;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import java.util.List;
import org.junit.jupiter.api.Test;

class PlayActionBoxLoadingShiftTests {

  private final PlayActionBoxLoadingShift shift = new PlayActionBoxLoadingShift();

  @Test
  void compute_noBoxLoading_returnsZero() {
    var context = ctx(PassConcept.PLAY_ACTION, 0.0);

    assertThat(shift.compute(context, rng())).isZero();
  }

  @Test
  void compute_playActionWithLoadedBox_returnsPositive() {
    var context = ctx(PassConcept.PLAY_ACTION, 1.0);

    var result = shift.compute(context, rng());

    assertThat(result).isEqualTo(PlayActionBoxLoadingShift.DEFAULT_SHIFT_PER_DEFENDER);
  }

  @Test
  void compute_dropbackWithLoadedBox_returnsZero() {
    var context = ctx(PassConcept.DROPBACK, 1.0);

    assertThat(shift.compute(context, rng())).isZero();
  }

  @Test
  void compute_screenWithLoadedBox_returnsZero() {
    var context = ctx(PassConcept.SCREEN, 1.0);

    assertThat(shift.compute(context, rng())).isZero();
  }

  @Test
  void compute_quickGameWithLoadedBox_returnsZero() {
    var context = ctx(PassConcept.QUICK_GAME, 1.0);

    assertThat(shift.compute(context, rng())).isZero();
  }

  @Test
  void compute_scalesLinearlyWithBoxLoadingShift() {
    var oneDefender = shift.compute(ctx(PassConcept.PLAY_ACTION, 1.0), rng());
    var twoDefenders = shift.compute(ctx(PassConcept.PLAY_ACTION, 2.0), rng());

    assertThat(twoDefenders).isEqualTo(2 * oneDefender);
  }

  private static PassMatchupContext ctx(PassConcept concept, double boxLoadingShift) {
    return new PassMatchupContext(
        concept,
        new PassRoles(List.of(), List.of(), List.of(), List.of()),
        OffensiveFormation.SINGLEBACK,
        CoverageShell.COVER_3,
        MatchupContextDefaults.OFFENSE,
        MatchupContextDefaults.DEFENSE,
        MatchupContextDefaults.EMPTY_ASSIGNMENT,
        boxLoadingShift);
  }

  private static SplittableRandomSource rng() {
    return new SplittableRandomSource(0L);
  }
}
