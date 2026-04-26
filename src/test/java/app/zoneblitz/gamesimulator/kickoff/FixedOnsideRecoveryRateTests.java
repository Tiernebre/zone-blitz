package app.zoneblitz.gamesimulator.kickoff;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class FixedOnsideRecoveryRateTests {

  private static final Team KICKING =
      new Team(
          new TeamId(new UUID(1L, 0L)),
          "Kicking",
          List.of(new Player(new PlayerId(new UUID(1L, 1L)), Position.K, "Kicker")));
  private static final Team RECEIVING =
      new Team(
          new TeamId(new UUID(2L, 0L)),
          "Receiving",
          List.of(new Player(new PlayerId(new UUID(2L, 1L)), Position.WR, "Returner")));

  @Test
  void compute_withDefaults_returnsLeagueBaselineRate() {
    var rate = new FixedOnsideRecoveryRate();

    assertThat(rate.compute(KICKING, RECEIVING)).isEqualTo(0.10);
  }

  @Test
  void compute_withCustomRate_returnsConfiguredValue() {
    var rate = new FixedOnsideRecoveryRate(0.25);

    assertThat(rate.compute(KICKING, RECEIVING)).isEqualTo(0.25);
  }

  @Test
  void constructor_whenRateOutOfRange_throws() {
    assertThatThrownBy(() -> new FixedOnsideRecoveryRate(-0.1))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new FixedOnsideRecoveryRate(1.5))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
