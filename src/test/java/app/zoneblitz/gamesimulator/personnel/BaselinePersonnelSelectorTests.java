package app.zoneblitz.gamesimulator.personnel;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.TestGameStates;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.roster.Physical;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Skill;
import app.zoneblitz.gamesimulator.roster.Team;
import app.zoneblitz.gamesimulator.roster.Tendencies;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class BaselinePersonnelSelectorTests {

  private final PersonnelSelector selector = new BaselinePersonnelSelector();

  @Test
  void selectOffense_uniformAttributesShotgunPass_returnsP11() {
    var team = team("HOME", 50);
    var state = TestGameStates.neutral(1, 10, 50);
    var call = new PlayCaller.PlayCall("pass");

    var offense = selector.selectOffense(call, state, team);

    assertThat(offense.pkg()).isEqualTo(OffensivePackage.P_11);
  }

  @Test
  void selectOffense_uniformAttributesSinglebackRun_returnsP11() {
    var team = team("HOME", 50);
    var state = TestGameStates.neutral(1, 10, 50);
    var call = new PlayCaller.PlayCall("run");

    var offense = selector.selectOffense(call, state, team);

    assertThat(offense.pkg()).isEqualTo(OffensivePackage.P_11);
  }

  @Test
  void selectOffense_jumboFormationGoalLine_returnsJumboPackage() {
    var team = team("HOME", 50);
    var state = TestGameStates.neutral(2, 1, 98);
    var call = new PlayCaller.PlayCall("run", RunConcept.POWER, OffensiveFormation.JUMBO);

    var offense = selector.selectOffense(call, state, team);

    assertThat(offense.pkg())
        .isIn(
            OffensivePackage.JUMBO_6OL_22,
            OffensivePackage.JUMBO_6OL_13,
            OffensivePackage.JUMBO_6OL_31,
            OffensivePackage.P_22,
            OffensivePackage.P_12);
  }

  @Test
  void selectOffense_emptyFormation_returnsFiveWideStylePackage() {
    var team = team("HOME", 50);
    var state = TestGameStates.neutral(3, 12, 50);
    var call =
        new PlayCaller.PlayCall(
            "pass",
            app.zoneblitz.gamesimulator.event.PassConcept.DROPBACK,
            OffensiveFormation.EMPTY);

    var offense = selector.selectOffense(call, state, team);

    assertThat(offense.pkg().rbs()).isLessThanOrEqualTo(1);
    assertThat(offense.pkg().wrs() + offense.pkg().tes()).isGreaterThanOrEqualTo(4);
  }

  @Test
  void selectDefense_thirdAndLong_returnsNickelOrDime() {
    var defenseTeam = defenseTeam("AWAY", 50);
    var offenseTeam = team("HOME", 50);
    var state = TestGameStates.neutral(3, 12, 50);
    var call =
        new PlayCaller.PlayCall(
            "pass",
            app.zoneblitz.gamesimulator.event.PassConcept.DROPBACK,
            OffensiveFormation.SHOTGUN);
    var offense = selector.selectOffense(call, state, offenseTeam);

    var defense = selector.selectDefense(call, offense, state, defenseTeam);

    assertThat(defense.pkg()).isIn(DefensivePackage.NICKEL_425, DefensivePackage.DIME_416);
  }

  @Test
  void selectDefense_goalLineShortYardage_returnsGoalLinePackage() {
    var defenseTeam = defenseTeam("AWAY", 50);
    var offenseTeam = team("HOME", 50);
    var state = TestGameStates.neutral(2, 1, 98);
    var call = new PlayCaller.PlayCall("run", RunConcept.POWER, OffensiveFormation.JUMBO);
    var offense = selector.selectOffense(call, state, offenseTeam);

    var defense = selector.selectDefense(call, offense, state, defenseTeam);

    assertThat(defense.pkg())
        .isIn(
            DefensivePackage.GOAL_LINE_551,
            DefensivePackage.GOAL_LINE_641,
            DefensivePackage.GOAL_LINE_632);
  }

  @Test
  void selectDefense_firstAndTen_returnsBasePackage() {
    var defenseTeam = defenseTeam("AWAY", 50);
    var offenseTeam = team("HOME", 50);
    var state = TestGameStates.neutral(1, 10, 50);
    var call =
        new PlayCaller.PlayCall("run", RunConcept.INSIDE_ZONE, OffensiveFormation.SINGLEBACK);
    var offense = selector.selectOffense(call, state, offenseTeam);

    var defense = selector.selectDefense(call, offense, state, defenseTeam);

    assertThat(defense.pkg()).isEqualTo(DefensivePackage.BASE_43);
  }

  @Test
  void selectOffense_strongTeRosterOnRun_biasesToward12Personnel() {
    var team = teamWithStrongTes("HOME");
    var state = TestGameStates.neutral(1, 10, 50);
    var call =
        new PlayCaller.PlayCall("run", RunConcept.INSIDE_ZONE, OffensiveFormation.SINGLEBACK);

    var offense = selector.selectOffense(call, state, team);

    assertThat(offense.pkg()).isIn(OffensivePackage.P_12, OffensivePackage.P_11);
  }

  @Test
  void selectOffense_uniformAttributesAcrossPackages_alwaysReturnsP11_neutralFormation() {
    var team = team("HOME", 50);
    var state = TestGameStates.neutral(1, 10, 50);

    for (var formation : List.of(OffensiveFormation.SHOTGUN, OffensiveFormation.SINGLEBACK)) {
      var call = new PlayCaller.PlayCall("run", RunConcept.INSIDE_ZONE, formation);
      var offense = selector.selectOffense(call, state, team);
      assertThat(offense.pkg())
          .as("uniform-50 roster on %s should fall through to P_11", formation)
          .isEqualTo(OffensivePackage.P_11);
    }
  }

  private static Team team(String label, int axisValue) {
    var roster = new ArrayList<Player>();
    addPlayers(roster, Position.QB, 2, label, 0, axisValue);
    addPlayers(roster, Position.RB, 3, label, 10, axisValue);
    addPlayers(roster, Position.FB, 1, label, 15, axisValue);
    addPlayers(roster, Position.TE, 3, label, 20, axisValue);
    addPlayers(roster, Position.WR, 5, label, 30, axisValue);
    addPlayers(roster, Position.OL, 8, label, 40, axisValue);
    return new Team(new TeamId(new UUID(9L, label.hashCode())), label, roster);
  }

  private static Team defenseTeam(String label, int axisValue) {
    var roster = new ArrayList<Player>();
    addPlayers(roster, Position.DL, 8, label, 50, axisValue);
    addPlayers(roster, Position.LB, 6, label, 60, axisValue);
    addPlayers(roster, Position.CB, 6, label, 70, axisValue);
    addPlayers(roster, Position.S, 4, label, 80, axisValue);
    return new Team(new TeamId(new UUID(9L, label.hashCode())), label, roster);
  }

  private static Team teamWithStrongTes(String label) {
    var roster = new ArrayList<Player>();
    addPlayers(roster, Position.QB, 2, label, 0, 50);
    addPlayers(roster, Position.RB, 3, label, 10, 50);
    addPlayers(roster, Position.TE, 3, label, 20, 95);
    addPlayers(roster, Position.WR, 5, label, 30, 30);
    addPlayers(roster, Position.OL, 8, label, 40, 50);
    return new Team(new TeamId(new UUID(9L, label.hashCode())), label, roster);
  }

  private static void addPlayers(
      List<Player> out, Position position, int count, String label, int idSeed, int axisValue) {
    for (var i = 0; i < count; i++) {
      var id = new PlayerId(new UUID(idSeed, i));
      var name = "%s %s%d".formatted(label, position.name(), i + 1);
      out.add(
          new Player(
              id,
              position,
              name,
              new Physical(
                  axisValue, axisValue, axisValue, axisValue, axisValue, axisValue, axisValue,
                  axisValue),
              new Skill(
                  axisValue, axisValue, axisValue, axisValue, axisValue, axisValue, axisValue,
                  axisValue, axisValue, axisValue, axisValue, axisValue, axisValue, axisValue,
                  axisValue, axisValue, axisValue, axisValue, axisValue, axisValue, axisValue,
                  axisValue, axisValue, axisValue, axisValue, axisValue, axisValue, axisValue,
                  axisValue),
              new Tendencies(
                  axisValue, axisValue, axisValue, axisValue, axisValue, axisValue, axisValue,
                  axisValue, axisValue)));
    }
  }
}
