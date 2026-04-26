package app.zoneblitz.gamesimulator.kickoff;

import static app.zoneblitz.gamesimulator.roster.PlayerBuilder.aPlayer;
import static app.zoneblitz.gamesimulator.roster.SkillBuilder.aSkill;
import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TouchbackKickoffResolverTests {

  private static final GameId GAME = new GameId(new UUID(9L, 9L));
  private static final GameClock OPENING_KICK = new GameClock(1, 0);
  private static final Score TIED = new Score(0, 0);

  @Test
  void resolve_whenMultipleKickersOnRoster_picksHighestKickPower() {
    var weakLegId = new PlayerId(new UUID(1L, 1L));
    var bigLegId = new PlayerId(new UUID(1L, 2L));
    var kicking =
        teamOf(
            "Kicking",
            aPlayer()
                .withId(weakLegId)
                .atPosition(Position.K)
                .withDisplayName("Weak Leg")
                .withSkill(aSkill().withKickPower(55))
                .build(),
            aPlayer()
                .withId(bigLegId)
                .atPosition(Position.K)
                .withDisplayName("Big Leg")
                .withSkill(aSkill().withKickPower(92))
                .build());
    var resolver = new TouchbackKickoffResolver();

    var resolved =
        resolver.resolve(
            kicking, anyReceivingTeam(), Side.HOME, GAME, 1, OPENING_KICK, TIED, rng());

    assertThat(resolved.event().kicker()).isEqualTo(bigLegId);
  }

  @Test
  void resolve_whenNoKickerOnRoster_fallsBackToFirstRosterPlayer() {
    var firstId = new PlayerId(new UUID(1L, 1L));
    var secondId = new PlayerId(new UUID(1L, 2L));
    var kicking =
        teamOf(
            "Kicking",
            aPlayer().withId(firstId).atPosition(Position.LB).withDisplayName("First").build(),
            aPlayer().withId(secondId).atPosition(Position.WR).withDisplayName("Second").build());
    var resolver = new TouchbackKickoffResolver();

    var resolved =
        resolver.resolve(
            kicking, anyReceivingTeam(), Side.HOME, GAME, 1, OPENING_KICK, TIED, rng());

    assertThat(resolved.event().kicker()).isEqualTo(firstId);
  }

  private static Team teamOf(String name, Player... players) {
    return new Team(new TeamId(new UUID(0L, name.hashCode())), name, List.of(players));
  }

  private static Team anyReceivingTeam() {
    return teamOf(
        "Receiving",
        aPlayer()
            .withId(new PlayerId(new UUID(2L, 1L)))
            .atPosition(Position.WR)
            .withDisplayName("Returner")
            .build());
  }

  private static SplittableRandomSource rng() {
    return new SplittableRandomSource(42L);
  }
}
