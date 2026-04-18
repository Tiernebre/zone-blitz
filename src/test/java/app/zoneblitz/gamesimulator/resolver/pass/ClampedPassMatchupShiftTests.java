package app.zoneblitz.gamesimulator.resolver.pass;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.formation.CoverageShell;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.personnel.TestPersonnel;
import app.zoneblitz.gamesimulator.resolver.PassRoleAssigner;
import app.zoneblitz.gamesimulator.resolver.PassRoles;
import app.zoneblitz.gamesimulator.resolver.PositionBasedPassRoleAssigner;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.Physical;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Skill;
import app.zoneblitz.gamesimulator.roster.Tendencies;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ClampedPassMatchupShiftTests {

  private final ClampedPassMatchupShift shift = new ClampedPassMatchupShift();
  private final PassRoleAssigner assigner = new PositionBasedPassRoleAssigner();

  private double computeFor(PassRoles roles) {
    return shift.compute(
        new PassMatchupContext(roles, OffensiveFormation.SHOTGUN, CoverageShell.COVER_3),
        new SplittableRandomSource(0L));
  }

  @Test
  void compute_averagePersonnel_returnsZero() {
    var offense = TestPersonnel.baselineOffense();
    var defense = TestPersonnel.baselineDefense();

    var result = computeFor(assigner.assign(pass(), offense, defense));

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
    var offense = TestPersonnel.offenseWith(wr);
    var defense = TestPersonnel.defenseWith(cb);

    var result = computeFor(assigner.assign(pass(), offense, defense));

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
    var offense = TestPersonnel.offenseWith(wr);
    var defense = TestPersonnel.defenseWith(olInCoverage);

    var clamped = computeFor(assigner.assign(pass(), offense, defense));
    var rawSkillDelta = (0.0) - (1.0);

    assertThat(clamped)
        .as("physical floor must lift the coverage delta above the raw −1 skill gap")
        .isGreaterThan(rawSkillDelta);
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
    var offense = TestPersonnel.offenseWith(poorWr);
    var defense = TestPersonnel.defenseWith(eliteCb);

    var clamped = computeFor(assigner.assign(pass(), offense, defense));
    var rawSkillDelta = 1.0 - 0.0;

    assertThat(clamped)
        .as("physical ceiling must pull the coverage delta below the raw +1 skill gap")
        .isLessThan(rawSkillDelta);
  }

  private static final PlayCaller.PlayCall PASS_CALL = new PlayCaller.PlayCall("pass");

  private static PlayCaller.PlayCall pass() {
    return PASS_CALL;
  }

  private static PlayerId pid(int seed) {
    return new PlayerId(new UUID(0L, seed));
  }
}
