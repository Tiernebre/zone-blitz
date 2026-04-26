package app.zoneblitz.gamesimulator.resolver.run;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.TestPersonnel;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.resolver.MatchupContextDefaults;
import app.zoneblitz.gamesimulator.resolver.RunRoles;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.role.RoleAssigner;
import app.zoneblitz.gamesimulator.role.SchemeFitRoleAssigner;
import app.zoneblitz.gamesimulator.roster.Physical;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Skill;
import app.zoneblitz.gamesimulator.roster.Tendencies;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RoleMatchupRunShiftTests {

  private final RoleMatchupRunShift shift = new RoleMatchupRunShift();
  private final RoleAssigner assigner = new SchemeFitRoleAssigner(MatchupContextDefaults.OFFENSE);

  private double computeFor(
      RunConcept concept, OffensivePersonnel offense, DefensivePersonnel defense) {
    var assignment = assigner.assign(run(), offense, defense);
    var roles = RunRoles.from(assignment);
    return shift.compute(
        new RunMatchupContext(
            concept,
            roles,
            OffensiveFormation.SINGLEBACK,
            50,
            10,
            MatchupContextDefaults.OFFENSE,
            MatchupContextDefaults.DEFENSE,
            assignment),
        new SplittableRandomSource(0L));
  }

  @Test
  void compute_averagePersonnel_returnsZero() {
    var offense = TestPersonnel.baselineOffense();
    var defense = TestPersonnel.baselineDefense();

    var result = computeFor(RunConcept.INSIDE_ZONE, offense, defense);

    assertThat(result).isZero();
  }

  @Test
  void compute_offenseSkillAdvantage_withMatchingPhysicals_returnsPositive() {
    var eliteRb =
        new Player(
            pid(1),
            Position.RB,
            "RB",
            Physical.average(),
            new Skill(
                50, 50, 50, 50, 50, 50, 50, 95, 95, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50,
                50, 50, 50, 50, 50, 50, 50, 50),
            Tendencies.average());
    var eliteOl =
        new Player(
            pid(2),
            Position.OL,
            "OL",
            Physical.average(),
            new Skill(
                50, 50, 50, 50, 50, 50, 95, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50,
                50, 50, 50, 50, 50, 50, 50, 50),
            Tendencies.average());
    var offense = TestPersonnel.offenseWith(eliteRb, eliteOl);
    var defense = TestPersonnel.baselineDefense();

    var result = computeFor(RunConcept.INSIDE_ZONE, offense, defense);

    assertThat(result).isPositive();
  }

  @Test
  void compute_defensePhysicalAdvantage_capsOffenseSkillAdvantage() {
    var poorCarrier =
        new Player(
            pid(1),
            Position.RB,
            "poor-RB",
            new Physical(30, 30, 30, 50, 50, 50, 50, 30),
            new Skill(
                50, 50, 50, 50, 50, 50, 50, 100, 100, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50,
                50, 50, 50, 50, 50, 50, 50, 50, 50),
            Tendencies.average());
    var poorBlocker =
        new Player(
            pid(2),
            Position.OL,
            "poor-OL",
            new Physical(30, 30, 30, 30, 30, 30, 30, 30),
            new Skill(
                50, 50, 50, 50, 50, 50, 100, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50,
                50, 50, 50, 50, 50, 50, 50, 50),
            Tendencies.average());
    var eliteDefender =
        new Player(
            pid(3),
            Position.DL,
            "elite-DL",
            new Physical(95, 95, 90, 95, 95, 50, 50, 90),
            Skill.average(),
            Tendencies.average());
    var offense = TestPersonnel.offenseWith(poorCarrier, poorBlocker);
    var defense = TestPersonnel.defenseWith(eliteDefender);

    var clamped = computeFor(RunConcept.INSIDE_ZONE, offense, defense);
    var rawSkillDeltaSum = (1.0 - 0.0) + (1.0 - 0.0);

    assertThat(clamped)
        .as("physical ceiling must cap the combined skill delta below the raw +2 sum")
        .isLessThan(rawSkillDeltaSum);
  }

  @Test
  void compute_carrierEliteBlockerWeak_favorsDrawOverPower() {
    var eliteCarrier =
        new Player(
            pid(1),
            Position.RB,
            "elite-RB",
            Physical.average(),
            new Skill(
                50, 50, 50, 50, 50, 50, 50, 100, 100, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50,
                50, 50, 50, 50, 50, 50, 50, 50, 50),
            Tendencies.average());
    var weakBlocker =
        new Player(
            pid(2),
            Position.OL,
            "weak-OL",
            Physical.average(),
            new Skill(
                50, 50, 50, 50, 50, 50, 0, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50,
                50, 50, 50, 50, 50, 50, 50, 50),
            Tendencies.average());
    var offense = TestPersonnel.offenseWith(eliteCarrier, weakBlocker);
    var defense = TestPersonnel.baselineDefense();

    var power = computeFor(RunConcept.POWER, offense, defense);
    var draw = computeFor(RunConcept.DRAW, offense, defense);

    assertThat(draw)
        .as("DRAW's 1.3 carrier weight amplifies the elite-carrier leg more than POWER's 0.8 does")
        .isGreaterThan(power);
  }

  private static PlayCaller.PlayCall run() {
    return new PlayCaller.PlayCall("run");
  }

  private static PlayerId pid(int seed) {
    return new PlayerId(new UUID(0L, seed));
  }
}
