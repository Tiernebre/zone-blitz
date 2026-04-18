package app.zoneblitz.gamesimulator.resolver.pass;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.resolver.PassRoleAssigner;
import app.zoneblitz.gamesimulator.resolver.PositionBasedPassRoleAssigner;
import app.zoneblitz.gamesimulator.roster.Physical;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Skill;
import app.zoneblitz.gamesimulator.roster.Team;
import app.zoneblitz.gamesimulator.roster.Tendencies;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ClampedPassMatchupShiftTests {

  private final ClampedPassMatchupShift shift = new ClampedPassMatchupShift();
  private final PassRoleAssigner assigner = new PositionBasedPassRoleAssigner();

  @Test
  void compute_averageRosters_returnsZero() {
    var offense = team(1, List.of(player(1, Position.WR), player(2, Position.OL)));
    var defense = team(2, List.of(player(1, Position.CB), player(2, Position.DL)));

    var result = shift.compute(assigner.assign(pass(), offense, defense), offense, defense);

    assertThat(result).isZero();
  }

  @Test
  void compute_offenseSkillAdvantage_withMatchingPhysicals_returnsPositive() {
    var wr =
        new Player(
            pid(1),
            Position.WR,
            "WR",
            Physical.average(),
            new Skill(50, 90, 50, 50, 50, 90, 50, 50, 50, 50),
            Tendencies.average());
    var cb =
        new Player(
            pid(2),
            Position.CB,
            "CB",
            Physical.average(),
            new Skill(50, 50, 50, 50, 50, 50, 50, 50, 50, 50),
            Tendencies.average());
    var offense = team(1, List.of(wr));
    var defense = team(2, List.of(cb));

    var result = shift.compute(assigner.assign(pass(), offense, defense), offense, defense);

    assertThat(result).isPositive();
  }

  @Test
  void compute_olCoveringEliteWr_physicalFloorLiftsDefenseSkillAdvantage() {
    var wr =
        new Player(
            pid(1),
            Position.WR,
            "WR",
            new Physical(95, 95, 90, 50, 50, 50, 50, 85),
            Skill.average(),
            Tendencies.average());
    var olInCoverage =
        new Player(
            pid(2),
            Position.CB,
            "OL-masquerading",
            new Physical(35, 35, 30, 95, 95, 20, 50, 25),
            new Skill(50, 50, 100, 50, 50, 50, 50, 50, 50, 50),
            Tendencies.average());
    var offense = team(1, List.of(wr));
    var defense = team(2, List.of(olInCoverage));

    var clamped = shift.compute(assigner.assign(pass(), offense, defense), offense, defense);
    var rawSkillDelta = (0.0) - (1.0);

    assertThat(clamped)
        .as("physical floor must lift the coverage delta above the raw −1 skill gap")
        .isGreaterThan(rawSkillDelta);
    assertThat(clamped).isGreaterThan(-0.5);
  }

  @Test
  void compute_eliteCoverageVsPoorWr_physicalCeilingCapsOffenseSkillAdvantage() {
    var poorWr =
        new Player(
            pid(1),
            Position.WR,
            "poor-WR",
            new Physical(35, 35, 30, 50, 50, 50, 50, 25),
            new Skill(50, 100, 50, 50, 50, 100, 50, 50, 50, 50),
            Tendencies.average());
    var eliteCb =
        new Player(
            pid(2),
            Position.CB,
            "elite-CB",
            new Physical(95, 95, 90, 50, 50, 50, 50, 85),
            Skill.average(),
            Tendencies.average());
    var offense = team(1, List.of(poorWr));
    var defense = team(2, List.of(eliteCb));

    var clamped = shift.compute(assigner.assign(pass(), offense, defense), offense, defense);
    var rawSkillDelta = 1.0 - 0.0;

    assertThat(clamped)
        .as("physical ceiling must pull the coverage delta below the raw +1 skill gap")
        .isLessThan(rawSkillDelta);
    assertThat(clamped).isLessThan(0.5);
  }

  private static final PlayCaller.PlayCall PASS_CALL = new PlayCaller.PlayCall("pass");

  private static PlayCaller.PlayCall pass() {
    return PASS_CALL;
  }

  private static Team team(int seed, List<Player> roster) {
    return new Team(new TeamId(new UUID(seed, 0L)), "Team-" + seed, roster);
  }

  private static Player player(int seed, Position position) {
    return new Player(pid(seed), position, position.name() + "-" + seed);
  }

  private static PlayerId pid(int seed) {
    return new PlayerId(new UUID(0L, seed));
  }
}
