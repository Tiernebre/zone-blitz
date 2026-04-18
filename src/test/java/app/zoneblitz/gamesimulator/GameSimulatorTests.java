package app.zoneblitz.gamesimulator;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.band.DefaultBandSampler;
import app.zoneblitz.gamesimulator.clock.BandClockModel;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.kickoff.TouchbackKickoffResolver;
import app.zoneblitz.gamesimulator.personnel.FakePersonnelSelector;
import app.zoneblitz.gamesimulator.personnel.TestPersonnel;
import app.zoneblitz.gamesimulator.roster.Coach;
import app.zoneblitz.gamesimulator.roster.CoachId;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import app.zoneblitz.gamesimulator.scoring.DistanceCurveFieldGoalResolver;
import app.zoneblitz.gamesimulator.scoring.FlatRateExtraPointResolver;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GameSimulatorTests {

  private static final GameId GAME_ID = new GameId(new UUID(42L, 99L));
  private static final PlayerId QB_ID = new PlayerId(new UUID(1L, 1L));
  private static final PlayerId WR_ID = new PlayerId(new UUID(1L, 2L));
  private static final Player QB = new Player(QB_ID, Position.QB, "Test QB");
  private static final Player WR = new Player(WR_ID, Position.WR, "Test WR");
  private static final Coach HOME_COACH = new Coach(new CoachId(new UUID(2L, 2L)), "Home Coach");
  private static final Coach AWAY_COACH = new Coach(new CoachId(new UUID(2L, 3L)), "Away Coach");
  private static final Player HOME_K =
      new Player(new PlayerId(new UUID(1L, 9L)), Position.K, "Home K");
  private static final Player AWAY_K =
      new Player(new PlayerId(new UUID(1L, 10L)), Position.K, "Away K");
  private static final Team HOME =
      new Team(new TeamId(new UUID(3L, 3L)), "Home Team", List.of(QB, WR, HOME_K));
  private static final Team AWAY =
      new Team(new TeamId(new UUID(4L, 4L)), "Away Team", List.of(AWAY_K));

  private SimulateGame newSimulator() {
    var personnel =
        new FakePersonnelSelector(TestPersonnel.baselineOffense(), TestPersonnel.baselineDefense());
    return new GameSimulator(
        ScriptedPlayCaller.runs(1),
        personnel,
        new ConstantPlayResolver(QB_ID, WR_ID),
        BandClockModel.load(new ClasspathBandRepository(), new DefaultBandSampler()),
        new TouchbackKickoffResolver(),
        new FlatRateExtraPointResolver(),
        new DistanceCurveFieldGoalResolver());
  }

  private static GameInputs inputs(Optional<Long> seed) {
    return new GameInputs(
        GAME_ID, HOME, AWAY, HOME_COACH, AWAY_COACH, new GameInputs.PreGameContext(), seed);
  }

  @Test
  void simulate_emitsContiguousSequencesAndTerminates() {
    var events = newSimulator().simulate(inputs(Optional.of(1L))).toList();

    assertThat(events).isNotEmpty();
    for (var i = 0; i < events.size(); i++) {
      assertThat(events.get(i).sequence()).isEqualTo(i);
    }
  }

  @Test
  void simulate_sameSeed_producesByteIdenticalStream() {
    var a = newSimulator().simulate(inputs(Optional.of(12345L))).toList();
    var b = newSimulator().simulate(inputs(Optional.of(12345L))).toList();

    assertThat(a).isEqualTo(b);
  }

  @Test
  void simulate_differentSeed_producesDifferentStream() {
    var a = newSimulator().simulate(inputs(Optional.of(1L))).toList();
    var b = newSimulator().simulate(inputs(Optional.of(2L))).toList();

    assertThat(a).isNotEqualTo(b);
  }

  @Test
  void simulate_ballCrossesGoalLine_emitsTouchdownFollowedByExtraPointAndKickoff() {
    var events = newSimulator().simulate(inputs(Optional.of(1L))).toList();

    var firstTdIndex = -1;
    for (var i = 0; i < events.size(); i++) {
      if (events.get(i) instanceof PlayEvent.PassComplete pc && pc.touchdown()) {
        firstTdIndex = i;
        break;
      }
    }
    assertThat(firstTdIndex)
        .as("expected at least one offensive touchdown")
        .isGreaterThanOrEqualTo(0);
    assertThat(events.get(firstTdIndex + 1)).isInstanceOf(PlayEvent.ExtraPoint.class);
    assertThat(events.get(firstTdIndex + 2)).isInstanceOf(PlayEvent.Kickoff.class);
  }

  @Test
  void simulate_finalScore_isNonZeroForAtLeastOneSide() {
    var events = newSimulator().simulate(inputs(Optional.of(1L))).toList();

    var last = events.get(events.size() - 1);
    assertThat(last.scoreAfter().home() + last.scoreAfter().away()).isPositive();
  }
}
