package app.zoneblitz.gamesimulator.resolver.run;

import static app.zoneblitz.gamesimulator.CalibrationAssertions.assertPercentile;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.band.DefaultBandSampler;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.resolver.RunOutcome;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class BaselineRunResolverCalibrationTests {

  private static final int TRIALS = 10_000;
  private static final PlayCaller.PlayCall RUN_CALL = new PlayCaller.PlayCall("run");

  private final BaselineRunResolver resolver =
      BaselineRunResolver.load(new ClasspathBandRepository(), new DefaultBandSampler());
  private final Team offense = offenseRoster();
  private final Team defense = defenseRoster();

  @Test
  void resolve_10kSnaps_yardage_percentilesMatch() {
    var yards = new ArrayList<Integer>();
    var rng = new SplittableRandomSource(42L);
    for (var i = 0; i < TRIALS; i++) {
      var outcome = resolver.resolve(RUN_CALL, state(), offense, defense, rng);
      assertThat(outcome).isInstanceOf(RunOutcome.Run.class);
      yards.add(((RunOutcome.Run) outcome).yards());
    }
    var sorted = yards.stream().mapToInt(Integer::intValue).sorted().toArray();
    assertPercentile(sorted, 0.10, 0, 2);
    assertPercentile(sorted, 0.25, 1, 2);
    assertPercentile(sorted, 0.50, 3, 2);
    assertPercentile(sorted, 0.75, 6, 2);
    assertPercentile(sorted, 0.90, 10, 2);
  }

  @Test
  void resolve_10kSnaps_yardage_respectsMinMax() {
    var rng = new SplittableRandomSource(1337L);
    for (var i = 0; i < TRIALS; i++) {
      var outcome = resolver.resolve(RUN_CALL, state(), offense, defense, rng);
      var yards = ((RunOutcome.Run) outcome).yards();
      assertThat(yards).isBetween(-28, 98);
    }
  }

  @Test
  void resolve_withoutCarrier_throwsIllegalState() {
    var noCarrierOffense =
        new Team(
            new TeamId(new UUID(9L, 9L)),
            "No Carrier",
            List.of(new Player(new PlayerId(new UUID(9L, 1L)), Position.WR, "WR")));
    var rng = new SplittableRandomSource(1L);

    assertThatThrownBy(() -> resolver.resolve(RUN_CALL, state(), noCarrierOffense, defense, rng))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("no rushing-eligible player on roster");
  }

  @Test
  void resolve_fallsBackToFB_whenNoRB() {
    var fbId = new PlayerId(new UUID(7L, 1L));
    var fbOnlyOffense =
        new Team(
            new TeamId(new UUID(7L, 0L)),
            "FB Only",
            List.of(
                new Player(fbId, Position.FB, "FB1"),
                new Player(new PlayerId(new UUID(7L, 2L)), Position.WR, "WR")));
    var rng = new SplittableRandomSource(5L);

    var outcome = resolver.resolve(RUN_CALL, state(), fbOnlyOffense, defense, rng);

    assertThat(outcome).isInstanceOf(RunOutcome.Run.class);
    assertThat(((RunOutcome.Run) outcome).carrier()).isEqualTo(fbId);
  }

  private static GameState state() {
    return GameState.initial();
  }

  private static Team offenseRoster() {
    return new Team(
        new TeamId(new UUID(1L, 0L)),
        "Offense",
        List.of(
            new Player(new PlayerId(new UUID(1L, 1L)), Position.QB, "QB"),
            new Player(new PlayerId(new UUID(1L, 2L)), Position.WR, "WR1"),
            new Player(new PlayerId(new UUID(1L, 3L)), Position.WR, "WR2"),
            new Player(new PlayerId(new UUID(1L, 4L)), Position.TE, "TE1"),
            new Player(new PlayerId(new UUID(1L, 5L)), Position.RB, "RB1")));
  }

  private static Team defenseRoster() {
    return new Team(
        new TeamId(new UUID(2L, 0L)),
        "Defense",
        List.of(
            new Player(new PlayerId(new UUID(2L, 1L)), Position.CB, "CB1"),
            new Player(new PlayerId(new UUID(2L, 2L)), Position.LB, "LB1"),
            new Player(new PlayerId(new UUID(2L, 3L)), Position.DL, "DL1")));
  }
}
