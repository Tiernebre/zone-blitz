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
import java.util.Random;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AttributeAwareCoverageShellSamplerTests {

  private final CoverageShellSampler sampler =
      BandCoverageShellSampler.load(new ClasspathBandRepository());

  @Test
  void sample_withAveragePersonnel_matchesBaselineDistribution() {
    var rng1 = new SeededRandom(123);
    var rng2 = new SeededRandom(123);
    var personnel = personnel(50, 50);
    var draws = 30_000;

    var baselineSingleHigh = 0;
    var attrSingleHigh = 0;
    for (var i = 0; i < draws; i++) {
      if (isSingleHigh(sampler.sample(OffensiveFormation.SHOTGUN, rng1))) baselineSingleHigh++;
      if (isSingleHigh(sampler.sample(OffensiveFormation.SHOTGUN, personnel, rng2)))
        attrSingleHigh++;
    }
    var baselineRate = baselineSingleHigh / (double) draws;
    var attrRate = attrSingleHigh / (double) draws;
    assertThat(attrRate).isCloseTo(baselineRate, org.assertj.core.data.Offset.offset(0.02));
  }

  @Test
  void sample_withFastWrRoom_producesMoreTwoHigh_thanSlowWrRoom() {
    var rng1 = new SeededRandom(7);
    var rng2 = new SeededRandom(7);
    var fastWrs = personnel(95, 95);
    var slowWrs = personnel(20, 20);
    var draws = 20_000;

    var fastTwoHigh = 0;
    var slowTwoHigh = 0;
    for (var i = 0; i < draws; i++) {
      if (isTwoHigh(sampler.sample(OffensiveFormation.SHOTGUN, fastWrs, rng1))) fastTwoHigh++;
      if (isTwoHigh(sampler.sample(OffensiveFormation.SHOTGUN, slowWrs, rng2))) slowTwoHigh++;
    }
    assertThat(fastTwoHigh / (double) draws).isGreaterThan(slowTwoHigh / (double) draws + 0.02);
  }

  private static boolean isSingleHigh(CoverageShell shell) {
    return shell == CoverageShell.COVER_1 || shell == CoverageShell.COVER_3;
  }

  private static boolean isTwoHigh(CoverageShell shell) {
    return shell == CoverageShell.COVER_2
        || shell == CoverageShell.QUARTERS
        || shell == CoverageShell.COVER_6
        || shell == CoverageShell.TWO_MAN;
  }

  private static OffensivePersonnel personnel(int wrSpeed, int wrRouteRunning) {
    var players = new ArrayList<Player>(11);
    players.add(player(Position.QB, "qb", 50, 50, 50));
    players.add(player(Position.RB, "rb", 50, 50, 50));
    players.add(player(Position.TE, "te", 50, 50, 50));
    players.add(player(Position.WR, "wr1", wrSpeed, wrRouteRunning, 50));
    players.add(player(Position.WR, "wr2", wrSpeed, wrRouteRunning, 50));
    players.add(player(Position.WR, "wr3", wrSpeed, wrRouteRunning, 50));
    for (var i = 0; i < 5; i++) {
      players.add(player(Position.OL, "ol" + i, 50, 50, 50));
    }
    return new OffensivePersonnel(OffensivePackage.P_11, players);
  }

  private static Player player(
      Position position, String name, int speed, int routeRunning, int hands) {
    var physical = new Physical(speed, 50, 50, 50, 50, 50, 50, 50);
    var skill =
        new Skill(
            50,
            routeRunning,
            50,
            50,
            50,
            hands,
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
            50,
            50,
            50,
            50,
            50,
            50,
            50);
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
