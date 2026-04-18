package app.zoneblitz.gamesimulator.resolver.run;

import static app.zoneblitz.gamesimulator.CalibrationAssertions.assertPercentile;
import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.band.DefaultBandSampler;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.TestPersonnel;
import app.zoneblitz.gamesimulator.resolver.RunOutcome;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import java.util.ArrayList;
import org.junit.jupiter.api.Test;

class BaselineRunResolverCalibrationTests {

  private static final int TRIALS = 10_000;
  private static final PlayCaller.PlayCall RUN_CALL = new PlayCaller.PlayCall("run");

  private final BaselineRunResolver resolver =
      BaselineRunResolver.load(new ClasspathBandRepository(), new DefaultBandSampler());
  private final OffensivePersonnel offense = TestPersonnel.baselineOffense();
  private final DefensivePersonnel defense = TestPersonnel.baselineDefense();

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

  private static GameState state() {
    return GameState.initial();
  }
}
