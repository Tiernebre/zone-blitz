package app.zoneblitz.gamesimulator.resolver;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.band.DefaultBandSampler;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class BaselineFumbleRecoveryModelTests {

  private final FumbleRecoveryModel model = new BaselineFumbleRecoveryModel(0.5);

  @Test
  void resolve_defenseWinsCoinFlip_recovererIsADefender() {
    var offense = players(Position.QB, "qb", "rb", "wr1");
    var defense = players(Position.DL, "dl1", "dl2", "dl3");
    var fumbler = offense.get(0).id();

    var outcome = model.resolve(fumbler, offense, defense, scripted(0.1, 0.0));

    assertThat(outcome.defenseRecovered()).isTrue();
    assertThat(outcome.recoveredBy()).isPresent();
    assertThat(defense).extracting(Player::id).contains(outcome.recoveredBy().get());
    assertThat(outcome.fumbledBy()).isEqualTo(fumbler);
  }

  @Test
  void resolve_offenseWinsCoinFlip_recovererIsAnOffensiveTeammateNotTheFumbler() {
    var offense = players(Position.QB, "qb", "rb", "wr1");
    var defense = players(Position.DL, "dl1", "dl2", "dl3");
    var fumbler = offense.get(0).id();

    var outcome = model.resolve(fumbler, offense, defense, scripted(0.9, 0.0));

    assertThat(outcome.defenseRecovered()).isFalse();
    assertThat(outcome.recoveredBy()).isPresent();
    var recoverer = outcome.recoveredBy().get();
    assertThat(recoverer).isNotEqualTo(fumbler);
    assertThat(offense).extracting(Player::id).contains(recoverer);
    assertThat(outcome.returnYards()).isZero();
  }

  @Test
  void resolve_probabilityThresholdEdge_defenseRecoversStrictlyBelowRate() {
    var offense = players(Position.QB, "qb", "rb");
    var defense = players(Position.DL, "dl1", "dl2");
    var fumbler = offense.get(0).id();

    var belowThreshold = model.resolve(fumbler, offense, defense, scripted(0.4999, 0.0));
    var aboveThreshold = model.resolve(fumbler, offense, defense, scripted(0.5000, 0.0));

    assertThat(belowThreshold.defenseRecovered()).isTrue();
    assertThat(aboveThreshold.defenseRecovered()).isFalse();
  }

  @Test
  void resolve_overManyTrials_defenseRateConvergesToConfiguredProbability() {
    var offense = players(Position.QB, "qb", "rb", "wr1", "wr2");
    var defense = players(Position.DL, "dl1", "dl2", "dl3", "dl4");
    var fumbler = offense.get(0).id();
    var rng = new SplittableRandomSource(7L);

    var trials = 10_000;
    var defenseCount = 0;
    for (var i = 0; i < trials; i++) {
      if (model.resolve(fumbler, offense, defense, rng).defenseRecovered()) {
        defenseCount++;
      }
    }

    var rate = defenseCount / (double) trials;
    assertThat(rate).as("configured rate = 0.5; ±3σ over 10k ≈ ±0.015").isBetween(0.475, 0.525);
  }

  @Test
  void resolve_offenseRecovery_distributesAcrossNonFumblerTeammates() {
    var offense = players(Position.QB, "qb", "rb", "wr1");
    var defense = players(Position.DL, "dl1", "dl2", "dl3");
    var fumbler = offense.get(0).id();
    var rng = new SplittableRandomSource(21L);
    var recoverers = new java.util.HashSet<PlayerId>();

    for (var i = 0; i < 500; i++) {
      var outcome = model.resolve(fumbler, offense, defense, rng);
      if (!outcome.defenseRecovered()) {
        recoverers.add(outcome.recoveredBy().get());
      }
    }

    assertThat(recoverers)
        .as("both non-fumbler teammates should appear over 500 trials")
        .hasSize(2);
    assertThat(recoverers).doesNotContain(fumbler);
  }

  @Test
  void resolve_whenFumblerIsSoleOffensivePlayer_defenseAlwaysRecovers() {
    var offense = List.of(player(Position.QB, "qb"));
    var defense = players(Position.DL, "dl1", "dl2");
    var fumbler = offense.get(0).id();

    var outcome = model.resolve(fumbler, offense, defense, scripted(0.99, 0.0));

    assertThat(outcome.defenseRecovered()).isTrue();
    assertThat(defense).extracting(Player::id).contains(outcome.recoveredBy().get());
  }

  @Test
  void resolve_defenseRecoveryWithBand_samplesReturnYards() {
    var repo = new ClasspathBandRepository();
    var sampler = new DefaultBandSampler();
    var band = repo.loadDistribution("rushing-plays.json", "bands.fumble_return_yards");
    var modelWithBand = new BaselineFumbleRecoveryModel(1.0, sampler, band);
    var offense = players(Position.QB, "qb", "rb");
    var defense = players(Position.DL, "dl1", "dl2", "dl3", "dl4");
    var fumbler = offense.get(0).id();
    var rng = new SplittableRandomSource(909L);
    var trials = 5_000;
    var nonZeroReturns = 0;
    var sum = 0L;
    var maxReturn = Integer.MIN_VALUE;
    for (var i = 0; i < trials; i++) {
      var outcome = modelWithBand.resolve(fumbler, offense, defense, rng);
      assertThat(outcome.defenseRecovered()).isTrue();
      sum += outcome.returnYards();
      if (outcome.returnYards() != 0) {
        nonZeroReturns++;
      }
      maxReturn = Math.max(maxReturn, outcome.returnYards());
    }
    var mean = sum / (double) trials;
    assertThat(mean)
        .as("fumble_return_yards band mean = 0.73; heavily zero-weighted distribution")
        .isBetween(0.1, 2.5);
    assertThat(nonZeroReturns)
        .as("at least some recoveries should produce non-zero returns from the tail")
        .isGreaterThan(50);
    assertThat(maxReturn)
        .as("the heavy tail must occasionally fire and produce a long return")
        .isGreaterThan(10);
  }

  @Test
  void resolve_offenseRecoveryWithBand_returnYardsStillZero() {
    var repo = new ClasspathBandRepository();
    var sampler = new DefaultBandSampler();
    var band = repo.loadDistribution("rushing-plays.json", "bands.fumble_return_yards");
    var modelWithBand = new BaselineFumbleRecoveryModel(0.0, sampler, band);
    var offense = players(Position.QB, "qb", "rb", "wr");
    var defense = players(Position.DL, "dl1", "dl2");
    var fumbler = offense.get(0).id();
    var rng = new SplittableRandomSource(77L);
    for (var i = 0; i < 500; i++) {
      var outcome = modelWithBand.resolve(fumbler, offense, defense, rng);
      assertThat(outcome.defenseRecovered()).isFalse();
      assertThat(outcome.returnYards()).isZero();
    }
  }

  @Test
  void resolve_emptyBothSides_throws() {
    var fumbler = new PlayerId(new UUID(0L, 1L));
    assertThatThrownBy(() -> model.resolve(fumbler, List.of(), List.of(), scripted(0.1, 0.0)))
        .isInstanceOf(IllegalArgumentException.class);
  }

  private static List<Player> players(Position position, String... names) {
    return java.util.Arrays.stream(names).map(n -> player(position, n)).toList();
  }

  private static Player player(Position position, String name) {
    return new Player(new PlayerId(UUID.randomUUID()), position, name);
  }

  private static RandomSource scripted(double... doubles) {
    return new ScriptedRandom(doubles);
  }

  private static final class ScriptedRandom implements RandomSource {
    private final double[] doubles;
    private final AtomicInteger cursor = new AtomicInteger();

    ScriptedRandom(double[] doubles) {
      this.doubles = doubles.clone();
    }

    @Override
    public long nextLong() {
      return 0L;
    }

    @Override
    public double nextDouble() {
      return doubles[cursor.getAndIncrement() % doubles.length];
    }

    @Override
    public double nextGaussian() {
      return 0.0;
    }

    @Override
    public RandomSource split(long key) {
      return this;
    }
  }
}
