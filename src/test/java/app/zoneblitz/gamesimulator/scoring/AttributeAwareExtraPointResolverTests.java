package app.zoneblitz.gamesimulator.scoring;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PatResult;
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

class AttributeAwareExtraPointResolverTests {

  private static final GameId GAME = new GameId(new UUID(7L, 7L));

  @Test
  void resolve_eliteAccuracy_lifsBaselineMakeRate() {
    var elite = teamWithKicker(skillWithKickAccuracy(95));
    var weak = teamWithKicker(skillWithKickAccuracy(15));

    var resolver = new AttributeAwareExtraPointResolver(new FlatRateExtraPointResolver(0.90));

    var eliteRate = makeRate(resolver, elite, 5_000);
    var weakRate = makeRate(resolver, weak, 5_000);

    assertThat(eliteRate - weakRate)
        .as("elite-vs-weak PAT spread should track the configured envelope")
        .isBetween(0.02, 0.10);
  }

  @Test
  void resolve_averageKicker_passesGuaranteedMakeThrough() {
    var team = teamWithKicker(Skill.average());
    var resolver = new AttributeAwareExtraPointResolver(new FlatRateExtraPointResolver(1.0));

    var resolved =
        resolver.resolve(
            team,
            Side.HOME,
            GAME,
            0,
            new GameClock(1, 600),
            new Score(6, 0),
            new SplittableRandomSource(99L));

    assertThat(resolved.event().result()).isEqualTo(PatResult.GOOD);
    assertThat(resolved.scoreAfter()).isEqualTo(new Score(7, 0));
  }

  @Test
  void resolve_averageKicker_passesGuaranteedMissThrough() {
    var team = teamWithKicker(Skill.average());
    var resolver = new AttributeAwareExtraPointResolver(new FlatRateExtraPointResolver(0.0));

    var resolved =
        resolver.resolve(
            team,
            Side.HOME,
            GAME,
            0,
            new GameClock(1, 600),
            new Score(6, 0),
            new SplittableRandomSource(99L));

    assertThat(resolved.event().result()).isEqualTo(PatResult.MISSED);
    assertThat(resolved.scoreAfter()).isEqualTo(new Score(6, 0));
  }

  private static double makeRate(ExtraPointResolver resolver, Team team, int iterations) {
    var made = 0;
    for (var i = 0; i < iterations; i++) {
      var resolved =
          resolver.resolve(
              team,
              Side.HOME,
              GAME,
              i,
              new GameClock(1, 600),
              new Score(0, 0),
              new SplittableRandomSource(31L + i));
      if (resolved.event().result() == PatResult.GOOD) {
        made++;
      }
    }
    return made / (double) iterations;
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

  private static Skill skillWithKickAccuracy(int kickAccuracy) {
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
        50,
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
