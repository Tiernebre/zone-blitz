package app.zoneblitz.gamesimulator.resolver.pass;

import static app.zoneblitz.gamesimulator.CalibrationAssertions.WILSON_Z_99;
import static app.zoneblitz.gamesimulator.CalibrationAssertions.assertPercentile;
import static app.zoneblitz.gamesimulator.CalibrationAssertions.wilsonContains;
import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.band.DefaultBandSampler;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.TestPersonnel;
import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.resolver.pass.BaselinePassResolver.PassOutcomeKind;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import java.util.ArrayList;
import java.util.EnumMap;
import org.junit.jupiter.api.Test;

class BaselinePassResolverCalibrationTests {

  private static final int TRIALS = 10_000;
  private static final PlayCaller.PlayCall PASS_CALL = new PlayCaller.PlayCall("pass");

  private final BaselinePassResolver resolver =
      BaselinePassResolver.load(new ClasspathBandRepository(), new DefaultBandSampler());
  private final OffensivePersonnel offense = TestPersonnel.baselineOffense();
  private final DefensivePersonnel defense = TestPersonnel.baselineDefense();

  @Test
  void resolve_10kSnaps_outcomeMix_withinWilson99CI() {
    var expected = new EnumMap<PassOutcomeKind, Double>(PassOutcomeKind.class);
    expected.put(PassOutcomeKind.COMPLETE, 0.5791);
    expected.put(PassOutcomeKind.INCOMPLETE, 0.2908);
    expected.put(PassOutcomeKind.INTERCEPTION, 0.0203);
    expected.put(PassOutcomeKind.SACK, 0.0629);
    expected.put(PassOutcomeKind.SCRAMBLE, 0.0469);

    var counts = new EnumMap<PassOutcomeKind, Integer>(PassOutcomeKind.class);
    for (var kind : PassOutcomeKind.values()) {
      counts.put(kind, 0);
    }
    var rng = new SplittableRandomSource(42L);
    for (var i = 0; i < TRIALS; i++) {
      var kind = classify(resolver.resolve(PASS_CALL, state(), offense, defense, rng));
      counts.merge(kind, 1, Integer::sum);
    }

    for (var entry : expected.entrySet()) {
      var observed = counts.get(entry.getKey()) / (double) TRIALS;
      assertThat(wilsonContains(observed, TRIALS, entry.getValue(), WILSON_Z_99))
          .as(
              "outcome %s: observed %.4f, expected %.4f",
              entry.getKey(), observed, entry.getValue())
          .isTrue();
    }
  }

  @Test
  void resolve_10kCompletions_completionYards_percentilesMatch() {
    var yards = new ArrayList<Integer>();
    var rng = new SplittableRandomSource(101L);
    while (yards.size() < TRIALS) {
      var outcome = resolver.resolve(PASS_CALL, state(), offense, defense, rng);
      if (outcome instanceof PassOutcome.PassComplete c) {
        yards.add(c.totalYards());
      }
    }
    var sorted = yards.stream().mapToInt(Integer::intValue).sorted().toArray();
    assertPercentile(sorted, 0.10, 2, 2);
    assertPercentile(sorted, 0.25, 5, 2);
    assertPercentile(sorted, 0.50, 8, 2);
    assertPercentile(sorted, 0.75, 14, 2);
    assertPercentile(sorted, 0.90, 22, 2);
  }

  @Test
  void resolve_10kSacks_sackYards_percentilesMatch() {
    var yardsLostNegated = new ArrayList<Integer>();
    var rng = new SplittableRandomSource(202L);
    while (yardsLostNegated.size() < TRIALS) {
      var outcome = resolver.resolve(PASS_CALL, state(), offense, defense, rng);
      if (outcome instanceof PassOutcome.Sack s) {
        yardsLostNegated.add(-s.yardsLost());
      }
    }
    var sorted = yardsLostNegated.stream().mapToInt(Integer::intValue).sorted().toArray();
    assertPercentile(sorted, 0.10, -11, 2);
    assertPercentile(sorted, 0.25, -9, 2);
    assertPercentile(sorted, 0.50, -7, 2);
    assertPercentile(sorted, 0.75, -4, 2);
    assertPercentile(sorted, 0.90, -1, 2);
  }

  @Test
  void resolve_10kScrambles_scrambleYards_percentilesMatch() {
    var yards = new ArrayList<Integer>();
    var rng = new SplittableRandomSource(303L);
    while (yards.size() < TRIALS) {
      var outcome = resolver.resolve(PASS_CALL, state(), offense, defense, rng);
      if (outcome instanceof PassOutcome.Scramble s) {
        yards.add(s.yards());
      }
    }
    var sorted = yards.stream().mapToInt(Integer::intValue).sorted().toArray();
    assertPercentile(sorted, 0.10, 2, 2);
    assertPercentile(sorted, 0.25, 3, 2);
    assertPercentile(sorted, 0.50, 6, 2);
    assertPercentile(sorted, 0.75, 10, 2);
    assertPercentile(sorted, 0.90, 14, 2);
  }

  private static PassOutcomeKind classify(PassOutcome outcome) {
    return switch (outcome) {
      case PassOutcome.PassComplete ignored -> PassOutcomeKind.COMPLETE;
      case PassOutcome.PassIncomplete ignored -> PassOutcomeKind.INCOMPLETE;
      case PassOutcome.Interception ignored -> PassOutcomeKind.INTERCEPTION;
      case PassOutcome.Sack ignored -> PassOutcomeKind.SACK;
      case PassOutcome.Scramble ignored -> PassOutcomeKind.SCRAMBLE;
    };
  }

  private static GameState state() {
    return GameState.initial();
  }
}
