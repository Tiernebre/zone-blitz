package app.zoneblitz.gamesimulator.resolver.run;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.resolver.PositionBasedRunRoleAssigner;
import app.zoneblitz.gamesimulator.resolver.RunRoleAssigner;
import app.zoneblitz.gamesimulator.roster.Physical;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Skill;
import app.zoneblitz.gamesimulator.roster.Team;
import app.zoneblitz.gamesimulator.roster.Tendencies;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ClampedRunMatchupShiftTests {

  private final ClampedRunMatchupShift shift = new ClampedRunMatchupShift();
  private final RunRoleAssigner assigner = new PositionBasedRunRoleAssigner();

  @Test
  void compute_averageRosters_returnsZero() {
    var offense =
        team(
            1,
            List.of(
                player(1, Position.RB, "RB"),
                player(2, Position.OL, "OL"),
                player(3, Position.FB, "FB")));
    var defense = team(2, List.of(player(1, Position.DL, "DL"), player(2, Position.LB, "LB")));

    var result =
        shift.compute(
            RunConcept.INSIDE_ZONE, assigner.assign(run(), offense, defense), offense, defense);

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
            new Skill(50, 50, 50, 50, 50, 50, 50, 95, 95, 50),
            Tendencies.average());
    var eliteOl =
        new Player(
            pid(2),
            Position.OL,
            "OL",
            Physical.average(),
            new Skill(50, 50, 50, 50, 50, 50, 95, 50, 50, 50),
            Tendencies.average());
    var defender =
        new Player(
            pid(3), Position.DL, "DL", Physical.average(), Skill.average(), Tendencies.average());
    var offense = team(1, List.of(eliteRb, eliteOl));
    var defense = team(2, List.of(defender));

    var result =
        shift.compute(
            RunConcept.INSIDE_ZONE, assigner.assign(run(), offense, defense), offense, defense);

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
            new Skill(50, 50, 50, 50, 50, 50, 50, 100, 100, 50),
            Tendencies.average());
    var poorBlocker =
        new Player(
            pid(2),
            Position.OL,
            "poor-OL",
            new Physical(30, 30, 30, 30, 30, 30, 30, 30),
            new Skill(50, 50, 50, 50, 50, 50, 100, 50, 50, 50),
            Tendencies.average());
    var eliteDefender =
        new Player(
            pid(3),
            Position.DL,
            "elite-DL",
            new Physical(95, 95, 90, 95, 95, 50, 50, 90),
            Skill.average(),
            Tendencies.average());
    var offense = team(1, List.of(poorCarrier, poorBlocker));
    var defense = team(2, List.of(eliteDefender));

    var clamped =
        shift.compute(
            RunConcept.INSIDE_ZONE, assigner.assign(run(), offense, defense), offense, defense);
    var rawSkillDeltaSum = (1.0 - 0.0) + (1.0 - 0.0);

    assertThat(clamped)
        .as("physical ceiling must cap the combined skill delta below the raw +2 sum")
        .isLessThan(rawSkillDeltaSum);
    assertThat(clamped).isLessThan(1.0);
  }

  @Test
  void compute_lightBoxDefense_favorsPowerOverOutsideZone() {
    // Defense: fast and long but weak at the point of attack — the classic "light box" nickel look.
    var lightBox =
        new Player(
            pid(3),
            Position.DL,
            "light-DL",
            new Physical(80, 50, 80, 30, 30, 50, 50, 70),
            Skill.average(),
            Tendencies.average());
    var offense = team(1, List.of(eliteCarrier(), eliteBlocker()));
    var defense = team(2, List.of(lightBox));

    var power =
        shift.compute(RunConcept.POWER, assigner.assign(run(), offense, defense), offense, defense);
    var outsideZone =
        shift.compute(
            RunConcept.OUTSIDE_ZONE, assigner.assign(run(), offense, defense), offense, defense);

    assertThat(power)
        .as("POWER measures the defense on interior anchor; a light box rates weak there")
        .isGreaterThan(outsideZone);
  }

  @Test
  void compute_heavySlowDefense_favorsOutsideZoneOverPower() {
    var heavySlow =
        new Player(
            pid(3),
            Position.DL,
            "heavy-DL",
            new Physical(30, 50, 30, 80, 80, 50, 50, 30),
            Skill.average(),
            Tendencies.average());
    var offense = team(1, List.of(eliteCarrier(), eliteBlocker()));
    var defense = team(2, List.of(heavySlow));

    var power =
        shift.compute(RunConcept.POWER, assigner.assign(run(), offense, defense), offense, defense);
    var outsideZone =
        shift.compute(
            RunConcept.OUTSIDE_ZONE, assigner.assign(run(), offense, defense), offense, defense);

    assertThat(outsideZone)
        .as("OUTSIDE_ZONE measures the defense on speed/pursuit; a heavy front rates weak there")
        .isGreaterThan(power);
  }

  @Test
  void compute_carrierEliteBlockerWeak_favorsDrawOverPower() {
    // Leg-weight asymmetry: DRAW is carrier-heavy (0.7/1.3); POWER is blocker-heavy (1.3/0.8).
    // An offense with an elite carrier and weak blockers should rate better under DRAW.
    var eliteCarrier =
        new Player(
            pid(1),
            Position.RB,
            "elite-RB",
            Physical.average(),
            new Skill(50, 50, 50, 50, 50, 50, 50, 100, 100, 50),
            Tendencies.average());
    var weakBlocker =
        new Player(
            pid(2),
            Position.OL,
            "weak-OL",
            Physical.average(),
            new Skill(50, 50, 50, 50, 50, 50, 0, 50, 50, 50),
            Tendencies.average());
    var defender =
        new Player(
            pid(3), Position.DL, "DL", Physical.average(), Skill.average(), Tendencies.average());
    var offense = team(1, List.of(eliteCarrier, weakBlocker));
    var defense = team(2, List.of(defender));

    var power =
        shift.compute(RunConcept.POWER, assigner.assign(run(), offense, defense), offense, defense);
    var draw =
        shift.compute(RunConcept.DRAW, assigner.assign(run(), offense, defense), offense, defense);

    assertThat(draw)
        .as("DRAW's 1.3 carrier weight amplifies the elite-carrier leg more than POWER's 0.8 does")
        .isGreaterThan(power);
  }

  private static Player eliteCarrier() {
    return new Player(
        pid(1),
        Position.RB,
        "elite-RB",
        Physical.average(),
        new Skill(50, 50, 50, 50, 50, 50, 50, 100, 100, 50),
        Tendencies.average());
  }

  private static Player eliteBlocker() {
    return new Player(
        pid(2),
        Position.OL,
        "elite-OL",
        Physical.average(),
        new Skill(50, 50, 50, 50, 50, 50, 100, 50, 50, 50),
        Tendencies.average());
  }

  private static PlayCaller.PlayCall run() {
    return new PlayCaller.PlayCall("run");
  }

  private static Player player(int seed, Position position, String name) {
    return new Player(pid(seed), position, name);
  }

  private static PlayerId pid(int seed) {
    return new PlayerId(new UUID(0L, seed));
  }

  private static Team team(int seed, List<Player> roster) {
    return new Team(new TeamId(new UUID(seed, 0L)), "team-" + seed, roster);
  }
}
