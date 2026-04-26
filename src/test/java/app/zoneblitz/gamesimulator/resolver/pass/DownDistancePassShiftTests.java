package app.zoneblitz.gamesimulator.resolver.pass;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.TestPersonnel;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.resolver.MatchupContextDefaults;
import app.zoneblitz.gamesimulator.role.RoleAssigner;
import app.zoneblitz.gamesimulator.role.RoleAssignmentPair;
import app.zoneblitz.gamesimulator.role.SchemeFitRoleAssigner;
import app.zoneblitz.gamesimulator.roster.PhysicalBuilder;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.PlayerBuilder;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.SkillBuilder;
import app.zoneblitz.gamesimulator.roster.TendenciesBuilder;
import org.junit.jupiter.api.Test;

class DownDistancePassShiftTests {

  private final SituationalPassShift shift = new DownDistancePassShift();
  private final RoleAssigner assigner = new SchemeFitRoleAssigner(MatchupContextDefaults.OFFENSE);

  @Test
  void compute_firstAndTen_returnsEmptyOffsets() {
    var offsets =
        shift.compute(
            stateAt(1, 10),
            assignmentFor(TestPersonnel.baselineOffense(), TestPersonnel.baselineDefense()));

    assertThat(offsets).isEmpty();
  }

  @Test
  void compute_thirdAndShort_returnsEmptyOffsets() {
    var offsets =
        shift.compute(
            stateAt(3, 3),
            assignmentFor(TestPersonnel.baselineOffense(), TestPersonnel.baselineDefense()));

    assertThat(offsets).isEmpty();
  }

  @Test
  void compute_thirdAndLongAtAverageAttributes_returnsLegacySackAndInterceptionLogitOffsets() {
    var offsets =
        shift.compute(
            stateAt(3, 10),
            assignmentFor(TestPersonnel.baselineOffense(), TestPersonnel.baselineDefense()));

    assertThat(offsets.get(PassOutcomeKind.SACK))
        .as("league-average attributes must preserve the historic +1.0 sack offset")
        .isEqualTo(1.0);
    assertThat(offsets.get(PassOutcomeKind.INTERCEPTION))
        .as("league-average attributes must preserve the historic +0.4 INT offset")
        .isEqualTo(0.4);
  }

  @Test
  void compute_thirdAndLongWithPoisedQbAndStrongOl_softensSackOffset() {
    var poisedQb =
        new PlayerBuilder()
            .atPosition(Position.QB)
            .withSkill(SkillBuilder.aSkill().withPocketPresence(95))
            .withTendencies(new TendenciesBuilder().withProcessing(95))
            .build();
    var strongOl =
        new PlayerBuilder()
            .atPosition(Position.OL)
            .withSkill(SkillBuilder.aSkill().withPassSet(95))
            .withPhysical(new PhysicalBuilder().withStrength(90).withPower(85))
            .build();
    var offense =
        TestPersonnel.offenseWith(
            poisedQb,
            strongOl,
            copyOl(strongOl, 1),
            copyOl(strongOl, 2),
            copyOl(strongOl, 3),
            copyOl(strongOl, 4));

    var offsets =
        shift.compute(stateAt(3, 10), assignmentFor(offense, TestPersonnel.baselineDefense()));

    assertThat(offsets.get(PassOutcomeKind.SACK))
        .as("poised QB behind elite OL must push the sack offset below the league-average +1.0")
        .isLessThan(1.0);
  }

  @Test
  void compute_thirdAndLongWithCleverQb_softensInterceptionOffset() {
    var smartQb =
        new PlayerBuilder()
            .atPosition(Position.QB)
            .withTendencies(new TendenciesBuilder().withFootballIq(95).withComposure(95))
            .build();
    var offense = TestPersonnel.offenseWith(smartQb);

    var offsets =
        shift.compute(stateAt(3, 10), assignmentFor(offense, TestPersonnel.baselineDefense()));

    assertThat(offsets.get(PassOutcomeKind.INTERCEPTION))
        .as("a high-IQ, composed QB must push the INT offset below the league-average +0.4")
        .isLessThan(0.4);
  }

  @Test
  void compute_thirdAndLongWithStatueQbAndWeakOl_amplifiesSackOffset() {
    var statueQb =
        new PlayerBuilder()
            .atPosition(Position.QB)
            .withSkill(SkillBuilder.aSkill().withPocketPresence(5))
            .withTendencies(new TendenciesBuilder().withProcessing(5))
            .build();
    var weakOl =
        new PlayerBuilder()
            .atPosition(Position.OL)
            .withSkill(SkillBuilder.aSkill().withPassSet(5))
            .build();
    var offense =
        TestPersonnel.offenseWith(
            statueQb,
            weakOl,
            copyOl(weakOl, 1),
            copyOl(weakOl, 2),
            copyOl(weakOl, 3),
            copyOl(weakOl, 4));

    var offsets =
        shift.compute(stateAt(3, 10), assignmentFor(offense, TestPersonnel.baselineDefense()));

    assertThat(offsets.get(PassOutcomeKind.SACK))
        .as("a statue QB behind weak OL must push the sack offset above the league-average +1.0")
        .isGreaterThan(1.0);
  }

  private static Player copyOl(Player base, int seed) {
    return new PlayerBuilder()
        .withId(0L, seed)
        .atPosition(Position.OL)
        .withSkill(SkillBuilder.aSkill().withPassSet(base.skill().passSet()))
        .withPhysical(
            new PhysicalBuilder()
                .withStrength(base.physical().strength())
                .withPower(base.physical().power()))
        .build();
  }

  private RoleAssignmentPair assignmentFor(OffensivePersonnel offense, DefensivePersonnel defense) {
    return assigner.assign(new PlayCaller.PlayCall("pass"), offense, defense);
  }

  private static GameState stateAt(int down, int yardsToGo) {
    var initial = GameState.initial();
    return new GameState(
        initial.score(),
        initial.clock(),
        new DownAndDistance(down, yardsToGo),
        initial.spot(),
        initial.possession(),
        initial.drive(),
        initial.fatigueSnapCounts(),
        initial.injuredPlayers(),
        initial.homeTimeouts(),
        initial.awayTimeouts(),
        initial.phase(),
        initial.overtimeRound(),
        initial.overtime(),
        initial.stats());
  }
}
