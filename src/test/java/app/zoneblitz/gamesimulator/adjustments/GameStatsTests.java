package app.zoneblitz.gamesimulator.adjustments;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.Side;
import java.util.List;
import org.junit.jupiter.api.Test;

class GameStatsTests {

  @Test
  void empty_returnsTwoEmptyTeamLogs() {
    var stats = GameStats.empty();

    assertThat(stats.home()).isEqualTo(TeamPlayLog.empty());
    assertThat(stats.away()).isEqualTo(TeamPlayLog.empty());
  }

  @Test
  void forOffense_home_returnsHomeLog() {
    var home = new TeamPlayLog(5, 30, 3, 0, 0, 0, 0, 0, 0, 0, 0, List.of());
    var stats = new GameStats(home, TeamPlayLog.empty());

    assertThat(stats.forOffense(Side.HOME)).isSameAs(home);
  }

  @Test
  void forDefense_isAliasForForOffense() {
    var away = new TeamPlayLog(0, 0, 0, 0, 0, 4, 20, 0, 0, 0, 0, List.of());
    var stats = new GameStats(TeamPlayLog.empty(), away);

    assertThat(stats.forDefense(Side.AWAY)).isSameAs(stats.forOffense(Side.AWAY));
  }

  @Test
  void withSide_replacesOnlyTargetSide() {
    var newHome = new TeamPlayLog(2, 12, 1, 0, 0, 0, 0, 0, 0, 0, 0, List.of());

    var stats = GameStats.empty().withSide(Side.HOME, newHome);

    assertThat(stats.home()).isSameAs(newHome);
    assertThat(stats.away()).isEqualTo(TeamPlayLog.empty());
  }

  @Test
  void decay_appliesToBothSides() {
    var stats =
        new GameStats(
            new TeamPlayLog(10, 80, 6, 0, 0, 0, 0, 0, 0, 0, 0, List.of()),
            new TeamPlayLog(0, 0, 0, 0, 0, 8, 40, 0, 0, 0, 0, List.of()));

    var decayed = stats.decay(0.5);

    assertThat(decayed.home().passAttempts()).isEqualTo(5);
    assertThat(decayed.away().rushAttempts()).isEqualTo(4);
  }
}
