package app.zoneblitz.gamesimulator.fatigue;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.personnel.DefensivePackage;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePackage;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.roster.DefensiveCoachTendencies;
import app.zoneblitz.gamesimulator.roster.Physical;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Skill;
import app.zoneblitz.gamesimulator.roster.Team;
import app.zoneblitz.gamesimulator.roster.Tendencies;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PositionalFatigueModelTests {

  private final FatigueModel model = new PositionalFatigueModel();

  @Test
  void performanceMultiplier_freshPlayer_returnsOne() {
    var rb = player(Position.RB, "rb-1", 50);
    assertThat(model.performanceMultiplier(rb, 0)).isEqualTo(1.0);
    assertThat(model.performanceMultiplier(rb, 10)).isEqualTo(1.0);
  }

  @Test
  void performanceMultiplier_pastThreshold_decaysBelowOne() {
    var rb = player(Position.RB, "rb-1", 50);
    var fresh = model.performanceMultiplier(rb, 35);
    var tired = model.performanceMultiplier(rb, 50);
    assertThat(fresh).isEqualTo(1.0);
    assertThat(tired).isLessThan(1.0);
  }

  @Test
  void performanceMultiplier_highMotor_degradesLaterThanLowMotor() {
    var lowMotor = player(Position.RB, "rb-low", 0);
    var highMotor = player(Position.RB, "rb-high", 100);

    var lowAt40 = model.performanceMultiplier(lowMotor, 40);
    var highAt40 = model.performanceMultiplier(highMotor, 40);

    assertThat(highAt40).isGreaterThan(lowAt40);
    assertThat(highAt40).isEqualTo(1.0);
    assertThat(lowAt40).isLessThan(1.0);
  }

  @Test
  void performanceMultiplier_floors_atSeventyPercent() {
    var rb = player(Position.RB, "rb-1", 50);
    var multiplier = model.performanceMultiplier(rb, 1000);
    assertThat(multiplier).isGreaterThanOrEqualTo(0.70);
  }

  @Test
  void rotateOffense_freshRb_keepsStarter() {
    var rb1 = player(Position.RB, "rb-1", 50);
    var rb2 = player(Position.RB, "rb-2", 50);
    var team = teamWith(rb1, rb2);
    var personnel = offenseWith(rb1);

    var rotated = model.rotateOffense(personnel, team, Map.of());

    assertThat(rotated.runningBacks()).extracting(Player::id).containsExactly(rb1.id());
  }

  @Test
  void rotateOffense_tiredRb_swapsInFresherBackup() {
    var rb1 = player(Position.RB, "rb-1", 50);
    var rb2 = player(Position.RB, "rb-2", 50);
    var team = teamWith(rb1, rb2);
    var personnel = offenseWith(rb1);

    var rotated = model.rotateOffense(personnel, team, Map.of(rb1.id(), 50));

    assertThat(rotated.runningBacks()).extracting(Player::id).containsExactly(rb2.id());
  }

  @Test
  void rotateOffense_tiredRbButNoFresherBackup_keepsStarter() {
    var rb1 = player(Position.RB, "rb-1", 50);
    var rb2 = player(Position.RB, "rb-2", 50);
    var team = teamWith(rb1, rb2);
    var personnel = offenseWith(rb1);

    var rotated = model.rotateOffense(personnel, team, Map.of(rb1.id(), 50, rb2.id(), 60));

    assertThat(rotated.runningBacks()).extracting(Player::id).containsExactly(rb1.id());
  }

  @Test
  void rotateDefense_tiredDl_swapsInFresherBackup() {
    var dl1 = player(Position.DL, "dl-1", 50);
    var dl2 = player(Position.DL, "dl-2", 50);
    var dl3 = player(Position.DL, "dl-3", 50);
    var dl4 = player(Position.DL, "dl-4", 50);
    var dl5 = player(Position.DL, "dl-5", 50);
    var defense = defenseWith(List.of(dl1, dl2, dl3, dl4));
    var team = teamWithDefense(dl1, dl2, dl3, dl4, dl5);

    var rotated =
        model.rotateDefense(
            defense, team, Map.of(dl1.id(), 60), DefensiveCoachTendencies.average());

    assertThat(rotated.defensiveLine()).extracting(Player::id).contains(dl5.id());
    assertThat(rotated.defensiveLine()).extracting(Player::id).doesNotContain(dl1.id());
  }

  private static Player player(Position position, String name, int motor) {
    return new Player(
        new PlayerId(UUID.nameUUIDFromBytes((position + "-" + name).getBytes())),
        position,
        name,
        Physical.average(),
        Skill.average(),
        new Tendencies(50, 50, 50, 50, 50, 50, 50, motor, 50));
  }

  private static OffensivePersonnel offenseWith(Player rb) {
    var qb = player(Position.QB, "qb", 50);
    var te = player(Position.TE, "te", 50);
    var wr1 = player(Position.WR, "wr-1", 50);
    var wr2 = player(Position.WR, "wr-2", 50);
    var wr3 = player(Position.WR, "wr-3", 50);
    var ol1 = player(Position.OL, "ol-1", 50);
    var ol2 = player(Position.OL, "ol-2", 50);
    var ol3 = player(Position.OL, "ol-3", 50);
    var ol4 = player(Position.OL, "ol-4", 50);
    var ol5 = player(Position.OL, "ol-5", 50);
    return new OffensivePersonnel(
        OffensivePackage.P_11, List.of(qb, rb, te, wr1, wr2, wr3, ol1, ol2, ol3, ol4, ol5));
  }

  private static DefensivePersonnel defenseWith(List<Player> dls) {
    var lb1 = player(Position.LB, "lb-1", 50);
    var lb2 = player(Position.LB, "lb-2", 50);
    var lb3 = player(Position.LB, "lb-3", 50);
    var cb1 = player(Position.CB, "cb-1", 50);
    var cb2 = player(Position.CB, "cb-2", 50);
    var s1 = player(Position.S, "s-1", 50);
    var s2 = player(Position.S, "s-2", 50);
    var roster = new ArrayList<Player>(11);
    roster.addAll(dls);
    roster.addAll(List.of(lb1, lb2, lb3, cb1, cb2, s1, s2));
    return new DefensivePersonnel(DefensivePackage.BASE_43, roster);
  }

  private static Team teamWith(Player... rbs) {
    var qb = player(Position.QB, "qb", 50);
    var te = player(Position.TE, "te", 50);
    var wr1 = player(Position.WR, "wr-1", 50);
    var wr2 = player(Position.WR, "wr-2", 50);
    var wr3 = player(Position.WR, "wr-3", 50);
    var ol1 = player(Position.OL, "ol-1", 50);
    var ol2 = player(Position.OL, "ol-2", 50);
    var ol3 = player(Position.OL, "ol-3", 50);
    var ol4 = player(Position.OL, "ol-4", 50);
    var ol5 = player(Position.OL, "ol-5", 50);
    var roster = new ArrayList<Player>();
    roster.addAll(List.of(rbs));
    roster.addAll(List.of(qb, te, wr1, wr2, wr3, ol1, ol2, ol3, ol4, ol5));
    return new Team(new TeamId(new UUID(0L, 1L)), "Test", roster);
  }

  private static Team teamWithDefense(Player... dls) {
    var lb1 = player(Position.LB, "lb-1", 50);
    var lb2 = player(Position.LB, "lb-2", 50);
    var lb3 = player(Position.LB, "lb-3", 50);
    var cb1 = player(Position.CB, "cb-1", 50);
    var cb2 = player(Position.CB, "cb-2", 50);
    var s1 = player(Position.S, "s-1", 50);
    var s2 = player(Position.S, "s-2", 50);
    var roster = new ArrayList<Player>();
    roster.addAll(List.of(dls));
    roster.addAll(List.of(lb1, lb2, lb3, cb1, cb2, s1, s2));
    return new Team(new TeamId(new UUID(0L, 2L)), "TestDef", roster);
  }
}
