package app.zoneblitz.gamesimulator.resolver.pass;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.formation.CoverageShell;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.TestPersonnel;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.resolver.MatchupContextDefaults;
import app.zoneblitz.gamesimulator.resolver.PassRoles;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.role.RoleAssigner;
import app.zoneblitz.gamesimulator.role.SchemeFitRoleAssigner;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.PlayerBuilder;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.SkillBuilder;
import java.util.List;
import org.junit.jupiter.api.Test;

class PlayActionBoxLoadingShiftTests {

  private final PlayActionBoxLoadingShift shift = new PlayActionBoxLoadingShift();
  private final RoleAssigner assigner = new SchemeFitRoleAssigner(MatchupContextDefaults.OFFENSE);

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

  @Test
  void compute_playActionWithEliteRunningBackOnly_amplifiesOverAverageRoster() {
    var eliteRb =
        new PlayerBuilder()
            .atPosition(Position.RB)
            .withSkill(SkillBuilder.aSkill().withBallCarrierVision(95).withBreakTackle(95))
            .build();
    var offense = TestPersonnel.offenseWith(eliteRb);
    var baseline =
        shift.compute(
            realCtx(
                PassConcept.PLAY_ACTION,
                1.0,
                TestPersonnel.baselineOffense(),
                TestPersonnel.baselineDefense()),
            rng());
    var amplified =
        shift.compute(
            realCtx(PassConcept.PLAY_ACTION, 1.0, offense, TestPersonnel.baselineDefense()), rng());

    assertThat(amplified)
        .as("an elite RB sells the run fake harder than an average RB")
        .isGreaterThan(baseline);
  }

  @Test
  void compute_playActionWithEliteRunBlockingLine_amplifiesOverAverageRoster() {
    var olOverrides = new Player[5];
    for (var i = 0; i < 5; i++) {
      olOverrides[i] =
          new PlayerBuilder()
              .withId(0L, 100 + i)
              .atPosition(Position.OL)
              .withSkill(SkillBuilder.aSkill().withRunBlock(95))
              .build();
    }
    var offense = TestPersonnel.offenseWith(olOverrides);
    var baseline =
        shift.compute(
            realCtx(
                PassConcept.PLAY_ACTION,
                1.0,
                TestPersonnel.baselineOffense(),
                TestPersonnel.baselineDefense()),
            rng());
    var amplified =
        shift.compute(
            realCtx(PassConcept.PLAY_ACTION, 1.0, offense, TestPersonnel.baselineDefense()), rng());

    assertThat(amplified)
        .as("an elite run-blocking OL sells the fake harder than an average line")
        .isGreaterThan(baseline);
  }

  @Test
  void compute_playActionWithWeakRunGameRoster_dampensBelowAverage() {
    var weakRb =
        new PlayerBuilder()
            .atPosition(Position.RB)
            .withSkill(SkillBuilder.aSkill().withBallCarrierVision(5).withBreakTackle(5))
            .build();
    var weakOl = new Player[5];
    for (var i = 0; i < 5; i++) {
      weakOl[i] =
          new PlayerBuilder()
              .withId(0L, 200 + i)
              .atPosition(Position.OL)
              .withSkill(SkillBuilder.aSkill().withRunBlock(5))
              .build();
    }
    var offense = TestPersonnel.offenseWith(concat(weakRb, weakOl));
    var baseline =
        shift.compute(
            realCtx(
                PassConcept.PLAY_ACTION,
                1.0,
                TestPersonnel.baselineOffense(),
                TestPersonnel.baselineDefense()),
            rng());
    var dampened =
        shift.compute(
            realCtx(PassConcept.PLAY_ACTION, 1.0, offense, TestPersonnel.baselineDefense()), rng());

    assertThat(dampened)
        .as("a non-credible run game shrinks the play-action boost")
        .isLessThan(baseline)
        .isPositive();
  }

  @Test
  void compute_playActionAtAverageRoster_preservesLegacyMagnitude() {
    var legacyAverageMagnitude = PlayActionBoxLoadingShift.DEFAULT_SHIFT_PER_DEFENDER;
    var result =
        shift.compute(
            realCtx(
                PassConcept.PLAY_ACTION,
                1.0,
                TestPersonnel.baselineOffense(),
                TestPersonnel.baselineDefense()),
            rng());

    assertThat(result)
        .as("league-average roster must reproduce the historic per-defender magnitude exactly")
        .isEqualTo(legacyAverageMagnitude);
  }

  private static Player[] concat(Player head, Player[] tail) {
    var out = new Player[tail.length + 1];
    out[0] = head;
    System.arraycopy(tail, 0, out, 1, tail.length);
    return out;
  }

  private PassMatchupContext realCtx(
      PassConcept concept,
      double boxLoadingShift,
      OffensivePersonnel offense,
      DefensivePersonnel defense) {
    var assignment = assigner.assign(new PlayCaller.PlayCall("pass"), offense, defense);
    var roles = PassRoles.from(assignment);
    return new PassMatchupContext(
        concept,
        roles,
        OffensiveFormation.SINGLEBACK,
        CoverageShell.COVER_3,
        MatchupContextDefaults.OFFENSE,
        MatchupContextDefaults.DEFENSE,
        assignment,
        boxLoadingShift);
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
