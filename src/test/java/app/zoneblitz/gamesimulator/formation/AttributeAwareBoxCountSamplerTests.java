package app.zoneblitz.gamesimulator.formation;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.personnel.OffensivePackage;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Physical;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Skill;
import app.zoneblitz.gamesimulator.roster.Tendencies;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AttributeAwareBoxCountSamplerTests {

  private final BoxCountSampler sampler = BandBoxCountSampler.load(new ClasspathBandRepository());

  @Test
  void sample_withAveragePersonnel_matchesBaselineDistribution() {
    var rng1 = new SeededRandom(424242);
    var rng2 = new SeededRandom(424242);
    var personnel = personnel(50);
    var draws = 30_000;

    var baselineTotal = 0L;
    var attrTotal = 0L;
    for (var i = 0; i < draws; i++) {
      baselineTotal += sampler.sample(OffensiveFormation.SINGLEBACK, PlayType.RUN, rng1);
      attrTotal += sampler.sample(OffensiveFormation.SINGLEBACK, PlayType.RUN, personnel, rng2);
    }
    var baselineMean = baselineTotal / (double) draws;
    var attrMean = attrTotal / (double) draws;
    assertThat(attrMean).isCloseTo(baselineMean, org.assertj.core.data.Offset.offset(0.05));
  }

  @Test
  void sample_withHeavyOl_producesHeavierBox_thanLightOl() {
    var rng1 = new SeededRandom(11);
    var rng2 = new SeededRandom(11);
    var heavy = personnelWithOlAttributes(95, 95, 95);
    var light = personnelWithOlAttributes(20, 20, 20);
    var draws = 20_000;

    var heavyTotal = 0L;
    var lightTotal = 0L;
    for (var i = 0; i < draws; i++) {
      heavyTotal += sampler.sample(OffensiveFormation.SINGLEBACK, PlayType.RUN, heavy, rng1);
      lightTotal += sampler.sample(OffensiveFormation.SINGLEBACK, PlayType.RUN, light, rng2);
    }
    assertThat(heavyTotal / (double) draws).isGreaterThan(lightTotal / (double) draws + 0.05);
  }

  @Test
  void expectedBox_withHeavyOl_isHeavierThanLightOl() {
    var heavy = personnelWithOlAttributes(95, 95, 95);
    var light = personnelWithOlAttributes(20, 20, 20);
    var heavyExpected = sampler.expectedBox(OffensiveFormation.SINGLEBACK, PlayType.RUN, heavy);
    var lightExpected = sampler.expectedBox(OffensiveFormation.SINGLEBACK, PlayType.RUN, light);
    assertThat(heavyExpected).isGreaterThan(lightExpected);
  }

  @Test
  void expectedBox_withAveragePersonnel_matchesBaseline() {
    var personnel = personnel(50);
    var baseline = sampler.expectedBox(OffensiveFormation.SINGLEBACK, PlayType.RUN);
    var attr = sampler.expectedBox(OffensiveFormation.SINGLEBACK, PlayType.RUN, personnel);
    assertThat(attr).isCloseTo(baseline, org.assertj.core.data.Offset.offset(1e-9));
  }

  private static OffensivePersonnel personnel(int axisValue) {
    return new OffensivePersonnel(OffensivePackage.P_11, buildP11Players(axisValue, axisValue));
  }

  private static OffensivePersonnel personnelWithOlAttributes(
      int olStrength, int olRunBlock, int olPower) {
    var players = new ArrayList<Player>(11);
    players.add(player(Position.QB, "qb", 50, 50, 50, 50, 50));
    players.add(player(Position.RB, "rb", 50, 50, 50, 50, 50));
    players.add(player(Position.TE, "te", 50, 50, 50, 50, 50));
    players.add(player(Position.WR, "wr1", 50, 50, 50, 50, 50));
    players.add(player(Position.WR, "wr2", 50, 50, 50, 50, 50));
    players.add(player(Position.WR, "wr3", 50, 50, 50, 50, 50));
    for (var i = 0; i < 5; i++) {
      players.add(player(Position.OL, "ol" + i, olStrength, olPower, 50, olRunBlock, 50));
    }
    return new OffensivePersonnel(OffensivePackage.P_11, players);
  }

  private static List<Player> buildP11Players(int physical, int skill) {
    var players = new ArrayList<Player>(11);
    players.add(player(Position.QB, "qb", physical, physical, physical, skill, skill));
    players.add(player(Position.RB, "rb", physical, physical, physical, skill, skill));
    players.add(player(Position.TE, "te", physical, physical, physical, skill, skill));
    players.add(player(Position.WR, "wr1", physical, physical, physical, skill, skill));
    players.add(player(Position.WR, "wr2", physical, physical, physical, skill, skill));
    players.add(player(Position.WR, "wr3", physical, physical, physical, skill, skill));
    for (var i = 0; i < 5; i++) {
      players.add(player(Position.OL, "ol" + i, physical, physical, physical, skill, skill));
    }
    return players;
  }

  private static Player player(
      Position position, String name, int strength, int power, int speed, int runBlock, int hands) {
    var physical = new Physical(speed, 50, 50, strength, power, 50, 50, 50);
    var skill =
        new Skill(
            50, 50, 50, 50, 50, hands, runBlock, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50,
            50, 50, 50, 50, 50, 50, 50, 50, 50);
    var tendencies = Tendencies.average();
    return new Player(
        new PlayerId(new UUID(0L, name.hashCode())), position, name, physical, skill, tendencies);
  }

  private static final class SeededRandom implements RandomSource {
    private final Random random;

    SeededRandom(long seed) {
      this.random = new Random(seed);
    }

    @Override
    public long nextLong() {
      return random.nextLong();
    }

    @Override
    public double nextDouble() {
      return random.nextDouble();
    }

    @Override
    public double nextGaussian() {
      return random.nextGaussian();
    }

    @Override
    public RandomSource split(long key) {
      return this;
    }
  }
}
