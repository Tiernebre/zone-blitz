package app.zoneblitz.scouting;

import static app.zoneblitz.gamesimulator.roster.PlayerBuilder.aPlayer;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.gamesimulator.role.DefensiveRole;
import app.zoneblitz.gamesimulator.scheme.BuiltinSchemeCatalog;
import app.zoneblitz.gamesimulator.scheme.DefensiveSchemeId;
import app.zoneblitz.gamesimulator.scheme.OffensiveSchemeId;
import app.zoneblitz.gamesimulator.scheme.ResolvedScheme;
import java.util.List;
import org.junit.jupiter.api.Test;

class EvaluateSchemeFitUseCaseTests {

  private final EvaluateSchemeFitUseCase evaluator = new EvaluateSchemeFitUseCase();
  private final BuiltinSchemeCatalog catalog = new BuiltinSchemeCatalog();

  private final ResolvedScheme defaultScheme =
      new ResolvedScheme(
          catalog.offense(OffensiveSchemeId.WEST_COAST),
          catalog.defense(DefensiveSchemeId.COVER_3_MATCH));

  @Test
  void evaluate_boxSafetyShapeFitsBoxSRoleBest() {
    var boxS = aPlayer().asBoxSafety().withId(1L, 1L).build();
    var rangeS = aPlayer().asRangeSafety().withId(1L, 2L).build();

    var fit = evaluator.evaluate(boxS, defaultScheme, List.of(boxS, rangeS));

    assertThat(fit.bestFit().role()).isEqualTo(DefensiveRole.BOX_S);
  }

  @Test
  void evaluate_rangeSafetyShapeFitsDeepSRoleBest() {
    var boxS = aPlayer().asBoxSafety().withId(1L, 1L).build();
    var rangeS = aPlayer().asRangeSafety().withId(1L, 2L).build();

    var fit = evaluator.evaluate(rangeS, defaultScheme, List.of(boxS, rangeS));

    assertThat(fit.bestFit().role()).isEqualTo(DefensiveRole.DEEP_S);
  }

  @Test
  void evaluate_returnsTieredFitsAgainstPool() {
    var subject = aPlayer().asBoxSafety().withId(1L, 1L).build();
    var weakerBox =
        aPlayer().asBoxSafety().withId(1L, 2L).withTackling(40).withBlockShedding(40).build();

    var fit = evaluator.evaluate(subject, defaultScheme, List.of(subject, weakerBox));

    assertThat(fit.bestFit().tier()).isIn(FitTier.A, FitTier.B);
  }

  @Test
  void evaluate_versatilityHighForBalancedShape() {
    var balanced = aPlayer().atPosition(app.zoneblitz.gamesimulator.roster.Position.S).build();

    var fit = evaluator.evaluate(balanced, defaultScheme, List.of(balanced));

    assertThat(fit.versatility()).isGreaterThan(0.7);
  }

  @Test
  void evaluate_emptyPoolStillProducesFit() {
    var s = aPlayer().asBoxSafety().withId(1L, 1L).build();

    var fit = evaluator.evaluate(s, defaultScheme, List.of());

    assertThat(fit.bestFit().role()).isEqualTo(DefensiveRole.BOX_S);
    assertThat(fit.bestFit().tier()).isEqualTo(FitTier.C);
  }

  @Test
  void evaluate_rejectsNullPlayer() {
    assertThatThrownBy(() -> evaluator.evaluate(null, defaultScheme, List.of()))
        .isInstanceOf(NullPointerException.class);
  }
}
