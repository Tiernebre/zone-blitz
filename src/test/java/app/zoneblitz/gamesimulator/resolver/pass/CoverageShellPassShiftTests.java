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
import app.zoneblitz.gamesimulator.roster.PhysicalBuilder;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.PlayerBuilder;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.SkillBuilder;
import app.zoneblitz.gamesimulator.roster.TendenciesBuilder;
import java.util.Map;
import org.junit.jupiter.api.Test;

class CoverageShellPassShiftTests {

  private final RoleAssigner assigner = new SchemeFitRoleAssigner(MatchupContextDefaults.OFFENSE);

  @Test
  void compute_emptyShellTableAndAverageAttributes_returnsZero() {
    var shift = new CoverageShellPassShift();

    var result =
        shift.compute(
            contextWith(TestPersonnel.baselineOffense(), TestPersonnel.baselineDefense()), rng());

    assertThat(result).isZero();
  }

  @Test
  void compute_loadedShellAndAverageAttributes_returnsConfiguredBase() {
    var shift = new CoverageShellPassShift(Map.of(CoverageShell.COVER_3, 0.20));

    var result =
        shift.compute(
            contextWith(TestPersonnel.baselineOffense(), TestPersonnel.baselineDefense()), rng());

    assertThat(result)
        .as("league-average attributes must reproduce the configured shell base exactly")
        .isEqualTo(0.20);
  }

  @Test
  void compute_strongSecondaryAndAverageRoute_returnsNegativeContribution() {
    var shift = new CoverageShellPassShift();
    var elite =
        new PlayerBuilder()
            .atPosition(Position.CB)
            .withSkill(SkillBuilder.aSkill().withCoverageTechnique(95).withPressCoverage(95))
            .withPhysical(new PhysicalBuilder().withSpeed(85).withAcceleration(85).withAgility(85))
            .withTendencies(new TendenciesBuilder())
            .build();
    var offense = TestPersonnel.baselineOffense();
    var defense =
        TestPersonnel.defenseWith(elite, elite(Position.CB), elite(Position.S), elite(Position.S));

    var result = shift.compute(contextWith(offense, defense), rng());

    assertThat(result)
        .as("a stacked secondary against average WRs must depress the offensive shift")
        .isNegative();
  }

  @Test
  void compute_eliteRoutesAgainstAverageSecondary_returnsPositiveContribution() {
    var shift = new CoverageShellPassShift();
    var eliteWr =
        new PlayerBuilder()
            .atPosition(Position.WR)
            .withSkill(
                SkillBuilder.aSkill().withRouteRunning(95).withRelease(95).withContestedCatch(80))
            .build();
    var offense =
        TestPersonnel.offenseWith(eliteWr, eliteRoute(Position.WR), eliteRoute(Position.WR));
    var defense = TestPersonnel.baselineDefense();

    var result = shift.compute(contextWith(offense, defense), rng());

    assertThat(result)
        .as("elite route runners against average coverage must lift the offensive shift")
        .isPositive();
  }

  @Test
  void compute_eliteSecondaryWithMatchingEliteRoutes_cancels() {
    var shift = new CoverageShellPassShift();
    var elite =
        new PlayerBuilder()
            .atPosition(Position.WR)
            .withSkill(
                SkillBuilder.aSkill()
                    .withRouteRunning(95)
                    .withRelease(95)
                    .withCoverageTechnique(95)
                    .withPressCoverage(95))
            .build();
    var route = elite;
    var coverageElite =
        new PlayerBuilder()
            .atPosition(Position.CB)
            .withSkill(
                SkillBuilder.aSkill()
                    .withRouteRunning(95)
                    .withRelease(95)
                    .withCoverageTechnique(95)
                    .withPressCoverage(95))
            .build();
    var offense =
        TestPersonnel.offenseWith(route, eliteRoute(Position.WR), eliteRoute(Position.WR));
    var symmetricDefense =
        TestPersonnel.defenseWith(
            coverageElite, elite(Position.CB), elite(Position.S), elite(Position.S));
    var asymmetricResult =
        shift.compute(contextWith(offense, TestPersonnel.baselineDefense()), rng());
    var symmetricResult = shift.compute(contextWith(offense, symmetricDefense), rng());

    assertThat(symmetricResult)
        .as("when both sides scale equally, the elite-on-elite term shrinks toward zero")
        .isLessThan(asymmetricResult);
  }

  private static Player elite(Position position) {
    return new PlayerBuilder()
        .atPosition(position)
        .withSkill(SkillBuilder.aSkill().withCoverageTechnique(95).withPressCoverage(95))
        .build();
  }

  private static Player eliteRoute(Position position) {
    return new PlayerBuilder()
        .atPosition(position)
        .withSkill(SkillBuilder.aSkill().withRouteRunning(95).withRelease(95))
        .build();
  }

  private PassMatchupContext contextWith(OffensivePersonnel offense, DefensivePersonnel defense) {
    var assignment = assigner.assign(new PlayCaller.PlayCall("pass"), offense, defense);
    var roles = PassRoles.from(assignment);
    return new PassMatchupContext(
        PassConcept.DROPBACK,
        roles,
        OffensiveFormation.SHOTGUN,
        CoverageShell.COVER_3,
        MatchupContextDefaults.OFFENSE,
        MatchupContextDefaults.DEFENSE,
        assignment);
  }

  private static SplittableRandomSource rng() {
    return new SplittableRandomSource(0L);
  }
}
