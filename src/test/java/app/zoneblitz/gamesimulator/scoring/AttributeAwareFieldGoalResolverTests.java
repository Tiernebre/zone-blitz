package app.zoneblitz.gamesimulator.scoring;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.Physical;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Skill;
import app.zoneblitz.gamesimulator.roster.Team;
import app.zoneblitz.gamesimulator.roster.Tendencies;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AttributeAwareFieldGoalResolverTests {

  private static final GameId GAME = new GameId(new UUID(9L, 9L));

  @Test
  void resolve_eliteKicker_makesMoreLongFieldGoalsThanWeakKicker() {
    var elite = teamWithKicker(skillWithKickAxes(95, 95));
    var weak = teamWithKicker(skillWithKickAxes(15, 15));

    var resolver = new AttributeAwareFieldGoalResolver(new DistanceCurveFieldGoalResolver());

    var eliteMakes = countMakes(resolver, elite, 35, 5_000);
    var weakMakes = countMakes(resolver, weak, 35, 5_000);

    assertThat(eliteMakes - weakMakes)
        .as("elite kicker should beat weak kicker by at least 200 makes per 5000 long-FG attempts")
        .isGreaterThan(200);
  }

  @Test
  void resolve_chipShot_attributesBarelyMatter() {
    var elite = teamWithKicker(skillWithKickAxes(95, 95));
    var weak = teamWithKicker(skillWithKickAxes(15, 15));

    var resolver = new AttributeAwareFieldGoalResolver(new DistanceCurveFieldGoalResolver());

    var eliteMakes = countMakes(resolver, elite, 95, 2_000);
    var weakMakes = countMakes(resolver, weak, 95, 2_000);

    assertThat(eliteMakes - weakMakes)
        .as("under the SHORT_FLOOR envelope, attribute spread is bounded")
        .isLessThan(50);
  }

  @Test
  void resolve_averageKicker_neutralOnDelegate() {
    var team = teamWithKicker(Skill.average());
    var alwaysMake = new DistanceCurveFieldGoalResolver(d -> 1.0);
    var resolver = new AttributeAwareFieldGoalResolver(alwaysMake);

    var resolved =
        resolver.resolve(
            team,
            Side.HOME,
            GAME,
            0,
            new FieldPosition(40),
            new DownAndDistance(4, 5),
            new GameClock(4, 60),
            new Score(0, 0),
            new SplittableRandomSource(7L));

    assertThat(resolved.made())
        .as("an average-everywhere kicker should never flip a guaranteed-make delegate")
        .isTrue();
  }

  @Test
  void shiftEnvelope_growsWithDistance() {
    assertThat(AttributeAwareFieldGoalResolver.shiftEnvelope(20)).isZero();
    assertThat(AttributeAwareFieldGoalResolver.shiftEnvelope(60))
        .isEqualTo(AttributeAwareFieldGoalResolver.MAX_SHIFT);
    assertThat(AttributeAwareFieldGoalResolver.shiftEnvelope(40))
        .isStrictlyBetween(0.0, AttributeAwareFieldGoalResolver.MAX_SHIFT);
  }

  private static int countMakes(
      FieldGoalResolver resolver, Team team, int yardLine, int iterations) {
    var makes = 0;
    for (var i = 0; i < iterations; i++) {
      var resolved =
          resolver.resolve(
              team,
              Side.HOME,
              GAME,
              i,
              new FieldPosition(yardLine),
              new DownAndDistance(4, 5),
              new GameClock(4, 60),
              new Score(0, 0),
              new SplittableRandomSource(424242L + i));
      if (resolved.made()) {
        makes++;
      }
    }
    return makes;
  }

  private static Team teamWithKicker(Skill skill) {
    var kicker =
        new Player(
            new PlayerId(new UUID(1L, 2L)),
            Position.K,
            "Kicker",
            Physical.average(),
            skill,
            Tendencies.average());
    return new Team(new TeamId(new UUID(1L, 1L)), "T", List.of(kicker));
  }

  private static Skill skillWithKickAxes(int kickPower, int kickAccuracy) {
    return new Skill(
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        kickPower,
        kickAccuracy,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50);
  }
}
