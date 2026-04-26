package app.zoneblitz.gamesimulator.resolver.pass;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.resolver.PassRoles;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.Physical;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Skill;
import app.zoneblitz.gamesimulator.roster.Tendencies;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import org.junit.jupiter.api.Test;

class QbPressureEscapeTests {

  private static final int TRIALS = 20_000;

  private final PressureModel model = new QbPressureEscape();

  @Test
  void resolve_averageAttributes_alwaysReturnsSack() {
    var roles = rolesWith(averageOl(5), averageDl(4));
    var qb = averageQb();
    var rng = new SplittableRandomSource(1L);

    var counts = sample(model, roles, qb, rng);

    assertThat(counts.sack)
        .as("average-everywhere roster must preserve nominal sack outcome by construction")
        .isEqualTo(TRIALS);
    assertThat(counts.scramble).isZero();
    assertThat(counts.throwaway).isZero();
  }

  @Test
  void resolve_mobileQbAgainstAverageProtection_raisesScrambleShare() {
    var roles = rolesWith(averageOl(5), averageDl(4));
    var averageCounts = sample(model, roles, averageQb(), new SplittableRandomSource(2L));
    var mobileCounts = sample(model, roles, mobileQb(), new SplittableRandomSource(2L));

    assertThat(mobileCounts.scramble)
        .as("high-mobility QB must redirect sacks toward scrambles")
        .isGreaterThan(averageCounts.scramble + TRIALS / 10);
    assertThat(mobileCounts.sack).isLessThan(averageCounts.sack);
  }

  @Test
  void resolve_awareQbAgainstAverageProtection_raisesThrowawayShare() {
    var roles = rolesWith(averageOl(5), averageDl(4));
    var averageCounts = sample(model, roles, averageQb(), new SplittableRandomSource(3L));
    var awareCounts = sample(model, roles, awareQb(), new SplittableRandomSource(3L));

    assertThat(awareCounts.throwaway)
        .as("high-awareness QB must redirect sacks toward throwaways")
        .isGreaterThan(averageCounts.throwaway + TRIALS / 10);
    assertThat(awareCounts.sack).isLessThan(averageCounts.sack);
  }

  @Test
  void resolve_dominantPassRushVsStatueQb_sackShareStaysHigh() {
    var roles = rolesWith(weakOl(5), elitePassRush(4));
    var counts = sample(model, roles, statueQb(), new SplittableRandomSource(4L));

    assertThat(counts.sack)
        .as("statue QB behind weak OL against elite rush cannot escape")
        .isGreaterThan((int) (TRIALS * 0.95));
  }

  @Test
  void resolve_eliteOlVsAverageDl_drivesEscapeMoreOftenThanAverageMatchup() {
    var averageRoles = rolesWith(averageOl(5), averageDl(4));
    var eliteOlRoles = rolesWith(eliteOl(5), averageDl(4));
    var qb = awareMobileQb();
    var averageCounts = sample(model, averageRoles, qb, new SplittableRandomSource(6L));
    var eliteOlCounts = sample(model, eliteOlRoles, qb, new SplittableRandomSource(6L));

    assertThat(eliteOlCounts.sack)
        .as("OL pass-pro attributes must reduce sack share even when DL is average")
        .isLessThan(averageCounts.sack);
  }

  @Test
  void resolve_elitePassRushVsAverageOl_compressesEscapeMoreThanAverageMatchup() {
    var averageRoles = rolesWith(averageOl(5), averageDl(4));
    var eliteRushRoles = rolesWith(averageOl(5), elitePassRush(4));
    var qb = awareMobileQb();
    var averageCounts = sample(model, averageRoles, qb, new SplittableRandomSource(7L));
    var eliteDlCounts = sample(model, eliteRushRoles, qb, new SplittableRandomSource(7L));

    assertThat(eliteDlCounts.sack)
        .as("DL pass-rush attributes must compress QB escape and raise sack share")
        .isGreaterThan(averageCounts.sack);
  }

  @Test
  void resolve_weakPassRushAgainstEliteOl_pressureModelDoesNotInflateSacksAboveSampled() {
    var roles = rolesWith(eliteOl(5), weakDl(4));
    var counts = sample(model, roles, awareMobileQb(), new SplittableRandomSource(5L));

    assertThat(counts.sack)
        .as(
            "with elite protection and an aware, mobile QB the initial sack sample should escape"
                + " as scramble or throwaway the vast majority of the time")
        .isLessThan(TRIALS / 2);
  }

  private static Counts sample(
      PressureModel model, PassRoles roles, Player qb, SplittableRandomSource rng) {
    var counts = new Counts();
    for (var i = 0; i < TRIALS; i++) {
      switch (model.resolve(roles, qb, rng)) {
        case SACK -> counts.sack++;
        case SCRAMBLE -> counts.scramble++;
        case THROWAWAY -> counts.throwaway++;
      }
    }
    return counts;
  }

  private static PassRoles rolesWith(List<Player> blockers, List<Player> rushers) {
    return new PassRoles(rushers, blockers, List.of(), List.of());
  }

  private static List<Player> averageOl(int n) {
    return generate(n, Position.OL, "ol", i -> Skill.average(), i -> Physical.average());
  }

  private static List<Player> eliteOl(int n) {
    return generate(
        n,
        Position.OL,
        "elite-ol",
        i -> skillWith(sb -> sb.passSet(95)),
        i -> physicalWith(pb -> pb.strength(95).power(95).agility(80).acceleration(80)));
  }

  private static List<Player> weakOl(int n) {
    return generate(
        n,
        Position.OL,
        "weak-ol",
        i -> skillWith(sb -> sb.passSet(15)),
        i -> physicalWith(pb -> pb.strength(25).power(25).agility(20).acceleration(20)));
  }

  private static List<Player> averageDl(int n) {
    return generate(n, Position.DL, "dl", i -> Skill.average(), i -> Physical.average());
  }

  private static List<Player> elitePassRush(int n) {
    return generate(
        n,
        Position.DL,
        "elite-dl",
        i -> skillWith(sb -> sb.passRushMoves(95).blockShedding(95)),
        i -> physicalWith(pb -> pb.speed(90).strength(90).power(90).explosiveness(90).bend(90)));
  }

  private static List<Player> weakDl(int n) {
    return generate(
        n,
        Position.DL,
        "weak-dl",
        i -> skillWith(sb -> sb.passRushMoves(15).blockShedding(15)),
        i -> physicalWith(pb -> pb.speed(25).strength(25).power(25).explosiveness(25).bend(25)));
  }

  private static Player averageQb() {
    return qb("avg-qb", Physical.average(), Skill.average(), Tendencies.average());
  }

  private static Player mobileQb() {
    return qb(
        "mobile-qb",
        physicalWith(pb -> pb.speed(95).acceleration(95).agility(95)),
        Skill.average(),
        Tendencies.average());
  }

  private static Player awareQb() {
    return qb(
        "aware-qb",
        Physical.average(),
        Skill.average(),
        tendenciesWith(tb -> tb.processing(95).footballIq(95)));
  }

  private static Player awareMobileQb() {
    return qb(
        "aware-mobile-qb",
        physicalWith(pb -> pb.speed(95).acceleration(95).agility(95)),
        Skill.average(),
        tendenciesWith(tb -> tb.processing(95).footballIq(95)));
  }

  private static Player statueQb() {
    return qb(
        "statue-qb",
        physicalWith(pb -> pb.speed(10).acceleration(10).agility(10)),
        Skill.average(),
        tendenciesWith(tb -> tb.processing(10).footballIq(10)));
  }

  private static Player qb(String name, Physical physical, Skill skill, Tendencies tendencies) {
    return new Player(
        new PlayerId(UUID.randomUUID()), Position.QB, name, physical, skill, tendencies);
  }

  private static List<Player> generate(
      int count,
      Position position,
      String prefix,
      Function<Integer, Skill> skill,
      Function<Integer, Physical> physical) {
    var players = new java.util.ArrayList<Player>(count);
    for (var i = 0; i < count; i++) {
      players.add(
          new Player(
              new PlayerId(UUID.randomUUID()),
              position,
              prefix + "-" + i,
              physical.apply(i),
              skill.apply(i),
              Tendencies.average()));
    }
    return List.copyOf(players);
  }

  private static Skill skillWith(Function<SkillBuilder, SkillBuilder> customize) {
    return customize.apply(new SkillBuilder()).build();
  }

  private static Physical physicalWith(Function<PhysicalBuilder, PhysicalBuilder> customize) {
    return customize.apply(new PhysicalBuilder()).build();
  }

  private static Tendencies tendenciesWith(
      Function<TendenciesBuilder, TendenciesBuilder> customize) {
    return customize.apply(new TendenciesBuilder()).build();
  }

  private static final class Counts {
    int sack;
    int scramble;
    int throwaway;
  }

  private static final class SkillBuilder {
    private int passSet = 50;
    private int routeRunning = 50;
    private int coverageTechnique = 50;
    private int passRushMoves = 50;
    private int blockShedding = 50;
    private int hands = 50;
    private int runBlock = 50;
    private int ballCarrierVision = 50;
    private int breakTackle = 50;
    private int tackling = 50;
    private int kickPower = 50;
    private int kickAccuracy = 50;
    private int puntPower = 50;
    private int puntAccuracy = 50;
    private int puntHangTime = 50;

    SkillBuilder passSet(int v) {
      this.passSet = v;
      return this;
    }

    SkillBuilder passRushMoves(int v) {
      this.passRushMoves = v;
      return this;
    }

    SkillBuilder blockShedding(int v) {
      this.blockShedding = v;
      return this;
    }

    Skill build() {
      return new Skill(
          passSet,
          routeRunning,
          coverageTechnique,
          passRushMoves,
          blockShedding,
          hands,
          runBlock,
          ballCarrierVision,
          breakTackle,
          tackling,
          kickPower,
          kickAccuracy,
          puntPower,
          puntAccuracy,
          puntHangTime,
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
    }
  }

  private static final class PhysicalBuilder {
    private int speed = 50;
    private int acceleration = 50;
    private int agility = 50;
    private int strength = 50;
    private int power = 50;
    private int bend = 50;
    private int stamina = 50;
    private int explosiveness = 50;

    PhysicalBuilder speed(int v) {
      this.speed = v;
      return this;
    }

    PhysicalBuilder acceleration(int v) {
      this.acceleration = v;
      return this;
    }

    PhysicalBuilder agility(int v) {
      this.agility = v;
      return this;
    }

    PhysicalBuilder strength(int v) {
      this.strength = v;
      return this;
    }

    PhysicalBuilder power(int v) {
      this.power = v;
      return this;
    }

    PhysicalBuilder bend(int v) {
      this.bend = v;
      return this;
    }

    PhysicalBuilder explosiveness(int v) {
      this.explosiveness = v;
      return this;
    }

    Physical build() {
      return new Physical(
          speed, acceleration, agility, strength, power, bend, stamina, explosiveness);
    }
  }

  private static final class TendenciesBuilder {
    private int composure = 50;
    private int discipline = 50;
    private int footballIq = 50;
    private int processing = 50;
    private int toughness = 50;
    private int clutch = 50;
    private int consistency = 50;
    private int motor = 50;

    TendenciesBuilder footballIq(int v) {
      this.footballIq = v;
      return this;
    }

    TendenciesBuilder processing(int v) {
      this.processing = v;
      return this;
    }

    Tendencies build() {
      return new Tendencies(
          composure, discipline, footballIq, processing, toughness, clutch, consistency, motor, 50);
    }
  }
}
