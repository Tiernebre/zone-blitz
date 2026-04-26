package app.zoneblitz.gamesimulator.resolver;

import static app.zoneblitz.gamesimulator.roster.PlayerBuilder.aPlayer;
import static app.zoneblitz.gamesimulator.roster.SkillBuilder.aSkill;
import static app.zoneblitz.gamesimulator.roster.TendenciesBuilder.aTendencies;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class AttributeAwareFumbleRecoveryModelTests {

  private final FumbleRecoveryModel model = new AttributeAwareFumbleRecoveryModel();

  // -------------------------------------------------------------------------
  // Basic structural guarantees
  // -------------------------------------------------------------------------

  @Test
  void resolve_defenseWinsSideCoin_recovererIsADefender() {
    var offense = List.of(player(Position.RB, "rb"), player(Position.WR, "wr"));
    var defense = List.of(player(Position.DL, "dl1"), player(Position.DL, "dl2"));
    var fumbler = offense.get(0).id();

    // Coin value < 0.5 → defense wins at baseline rate
    var outcome = model.resolve(fumbler, offense, defense, scripted(0.1, 0.0));

    assertThat(outcome.defenseRecovered()).isTrue();
    assertThat(outcome.recoveredBy()).isPresent();
    assertThat(defense).extracting(Player::id).contains(outcome.recoveredBy().get());
    assertThat(outcome.fumbledBy()).isEqualTo(fumbler);
  }

  @Test
  void resolve_offenseWinsSideCoin_recovererIsANonFumblerTeammate() {
    var rb = player(Position.RB, "rb");
    var wr = player(Position.WR, "wr");
    var offense = List.of(rb, wr);
    var defense = List.of(player(Position.DL, "dl1"));
    var fumbler = rb.id();

    // Coin value > 0.5 → offense wins at baseline rate
    var outcome = model.resolve(fumbler, offense, defense, scripted(0.9, 0.0));

    assertThat(outcome.defenseRecovered()).isFalse();
    assertThat(outcome.recoveredBy()).isPresent();
    assertThat(outcome.recoveredBy().get()).isNotEqualTo(fumbler);
    assertThat(outcome.recoveredBy().get()).isEqualTo(wr.id());
    assertThat(outcome.returnYards()).isZero();
  }

  @Test
  void resolve_fumbledBy_isRecordedOnOutcome() {
    var offense = List.of(player(Position.QB, "qb"), player(Position.RB, "rb"));
    var defense = List.of(player(Position.DL, "dl1"));
    var fumbler = offense.get(0).id();

    var outcome = model.resolve(fumbler, offense, defense, scripted(0.9, 0.0));

    assertThat(outcome.fumbledBy()).isEqualTo(fumbler);
  }

  @Test
  void resolve_emptyBothSides_throws() {
    var fumbler = new PlayerId(new UUID(0L, 1L));
    assertThatThrownBy(() -> model.resolve(fumbler, List.of(), List.of(), scripted(0.1, 0.0)))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void resolve_fumblerIsSoleOffensivePlayer_defenseAlwaysRecovers() {
    var offense = List.of(player(Position.QB, "qb"));
    var defense = List.of(player(Position.DL, "dl1"), player(Position.DL, "dl2"));
    var fumbler = offense.get(0).id();

    // Even with coin value > 0.5, offense has no candidates so defense must win
    var outcome = model.resolve(fumbler, offense, defense, scripted(0.99, 0.0));

    assertThat(outcome.defenseRecovered()).isTrue();
  }

  @Test
  void resolve_returnYards_alwaysZero() {
    var offense = List.of(player(Position.RB, "rb"), player(Position.WR, "wr"));
    var defense = List.of(player(Position.DL, "dl1"));
    var fumbler = offense.get(0).id();
    var rng = new SplittableRandomSource(42L);

    for (var i = 0; i < 100; i++) {
      var outcome = model.resolve(fumbler, offense, defense, rng);
      assertThat(outcome.returnYards()).isZero();
    }
  }

  // -------------------------------------------------------------------------
  // Ball-security shift: carrier attributes shift side coin toward offense
  // -------------------------------------------------------------------------

  @Test
  void resolve_eliteBallSecurityCarrier_shiftsSideCoinTowardOffense() {
    // Elite ball-security carrier: ballCarrierVision=95, breakTackle=90
    var eliteCarrier =
        aPlayer()
            .atPosition(Position.RB)
            .withDisplayName("elite-rb")
            .withSkill(aSkill().withBallCarrierVision(95).withBreakTackle(90))
            .build();
    var teammate = player(Position.WR, "wr");
    var offense = List.of(eliteCarrier, teammate);

    // Average-everywhere defenders
    var defense =
        List.of(
            player(Position.DL, "dl1"),
            player(Position.DL, "dl2"),
            player(Position.DL, "dl3"),
            player(Position.LB, "lb1"));
    var fumbler = eliteCarrier.id();
    var rng = new SplittableRandomSource(1001L);

    var trials = 10_000;
    var defenseCount = 0;
    for (var i = 0; i < trials; i++) {
      if (model.resolve(fumbler, offense, defense, rng).defenseRecovered()) {
        defenseCount++;
      }
    }

    var defenseRate = defenseCount / (double) trials;
    // Elite carrier shifts defense rate below 0.50 — expect < 0.45 with high confidence
    assertThat(defenseRate)
        .as("elite ball-security should shift defense recovery below 0.45")
        .isLessThan(0.45);
  }

  @Test
  void resolve_weakBallSecurityCarrier_shiftsSideCoinTowardDefense() {
    // Weak ball-security carrier: ballCarrierVision=5, breakTackle=10
    var weakCarrier =
        aPlayer()
            .atPosition(Position.RB)
            .withDisplayName("weak-rb")
            .withSkill(aSkill().withBallCarrierVision(5).withBreakTackle(10))
            .build();
    var teammate = player(Position.WR, "wr");
    var offense = List.of(weakCarrier, teammate);

    // Average-everywhere defenders
    var defense =
        List.of(
            player(Position.DL, "dl1"),
            player(Position.DL, "dl2"),
            player(Position.DL, "dl3"),
            player(Position.LB, "lb1"));
    var fumbler = weakCarrier.id();
    var rng = new SplittableRandomSource(2002L);

    var trials = 10_000;
    var defenseCount = 0;
    for (var i = 0; i < trials; i++) {
      if (model.resolve(fumbler, offense, defense, rng).defenseRecovered()) {
        defenseCount++;
      }
    }

    var defenseRate = defenseCount / (double) trials;
    // Weak carrier shifts defense rate above 0.50 — expect > 0.55
    assertThat(defenseRate)
        .as("weak ball-security should shift defense recovery above 0.55")
        .isGreaterThan(0.55);
  }

  // -------------------------------------------------------------------------
  // Bounded envelope: extreme attributes cannot exceed [0.30, 0.70]
  // -------------------------------------------------------------------------

  @Test
  void resolve_extremelyEliteCarrierVsWeakDefense_defenseRateStaysAboveFloor() {
    // Perfect ball-security carrier
    var perfectCarrier =
        aPlayer()
            .atPosition(Position.RB)
            .withDisplayName("perfect-rb")
            .withSkill(aSkill().withBallCarrierVision(100).withBreakTackle(100))
            .withTendencies(aTendencies().withFootballIq(100))
            .build();
    var teammate = player(Position.WR, "wr");
    var offense = List.of(perfectCarrier, teammate);

    // Zero-rated defenders (worst possible pursuit)
    var worstDefender =
        aPlayer()
            .atPosition(Position.DL)
            .withDisplayName("worst-dl")
            .withSkill(aSkill().withBlockShedding(0))
            .withTendencies(aTendencies().withFootballIq(0))
            .build();
    var defense = List.of(worstDefender, worstDefender, worstDefender);
    var fumbler = perfectCarrier.id();
    var rng = new SplittableRandomSource(3003L);

    var trials = 10_000;
    var defenseCount = 0;
    for (var i = 0; i < trials; i++) {
      if (model.resolve(fumbler, offense, defense, rng).defenseRecovered()) {
        defenseCount++;
      }
    }

    var defenseRate = defenseCount / (double) trials;
    // Even at the extreme, defense rate stays above the 0.30 floor
    assertThat(defenseRate)
        .as(
            "envelope clamp should keep defense recovery rate above 0.30 even at extreme"
                + " attributes")
        .isGreaterThan(0.28); // ±3σ tolerance over 10k trials
  }

  @Test
  void resolve_extremelyWeakCarrierVsEliteDefense_defenseRateStaysBelowCeiling() {
    // Zero ball-security carrier
    var worstCarrier =
        aPlayer()
            .atPosition(Position.RB)
            .withDisplayName("worst-rb")
            .withSkill(aSkill().withBallCarrierVision(0).withBreakTackle(0))
            .withTendencies(aTendencies().withFootballIq(0))
            .build();
    var teammate = player(Position.WR, "wr");
    var offense = List.of(worstCarrier, teammate);

    // Perfect defenders
    var perfectDefender =
        aPlayer()
            .atPosition(Position.DL)
            .withDisplayName("elite-dl")
            .withSkill(aSkill().withBlockShedding(100))
            .withTendencies(aTendencies().withFootballIq(100))
            .build();
    var defense = List.of(perfectDefender, perfectDefender, perfectDefender);
    var fumbler = worstCarrier.id();
    var rng = new SplittableRandomSource(4004L);

    var trials = 10_000;
    var defenseCount = 0;
    for (var i = 0; i < trials; i++) {
      if (model.resolve(fumbler, offense, defense, rng).defenseRecovered()) {
        defenseCount++;
      }
    }

    var defenseRate = defenseCount / (double) trials;
    // Even at the extreme, defense rate stays below the 0.70 ceiling
    assertThat(defenseRate)
        .as(
            "envelope clamp should keep defense recovery rate below 0.70 even at extreme"
                + " attributes")
        .isLessThan(0.72); // ±3σ tolerance over 10k trials
  }

  // -------------------------------------------------------------------------
  // Average-attribute convergence: behaves like 50/50 baseline
  // -------------------------------------------------------------------------

  @Test
  void resolve_averageAttributesEverywhere_defenseRateConvergesToFiftyPercent() {
    var offense =
        List.of(player(Position.RB, "rb"), player(Position.WR, "wr1"), player(Position.WR, "wr2"));
    var defense =
        List.of(
            player(Position.DL, "dl1"),
            player(Position.DL, "dl2"),
            player(Position.LB, "lb1"),
            player(Position.CB, "cb1"));
    var fumbler = offense.get(0).id();
    var rng = new SplittableRandomSource(5005L);

    var trials = 10_000;
    var defenseCount = 0;
    for (var i = 0; i < trials; i++) {
      if (model.resolve(fumbler, offense, defense, rng).defenseRecovered()) {
        defenseCount++;
      }
    }

    var defenseRate = defenseCount / (double) trials;
    // Average attributes → shift = 0 → should converge near 0.50 (±3σ ≈ ±0.015)
    assertThat(defenseRate)
        .as("average attributes should produce baseline 50/50 recovery rate")
        .isBetween(0.475, 0.525);
  }

  // -------------------------------------------------------------------------
  // Weighted recoverer pick: elite-awareness player wins more often than average
  // -------------------------------------------------------------------------

  @Test
  void resolve_eliteAwarenessDefender_recoversBallMoreFrequentlyThanLowAwarenessTeammate() {
    var rb = player(Position.RB, "rb");
    var wr = player(Position.WR, "wr");
    var offense = List.of(rb, wr);

    // Two defenders: one elite-awareness (footballIq=90, blockShedding=85), one poor (both=15)
    var eliteDefender =
        aPlayer()
            .atPosition(Position.DL)
            .withDisplayName("elite-dl")
            .withSkill(aSkill().withBlockShedding(85))
            .withTendencies(aTendencies().withFootballIq(90))
            .build();
    var poorDefender =
        aPlayer()
            .atPosition(Position.DL)
            .withDisplayName("poor-dl")
            .withSkill(aSkill().withBlockShedding(15))
            .withTendencies(aTendencies().withFootballIq(15))
            .build();
    var defense = List.of(eliteDefender, poorDefender);
    var fumbler = rb.id();

    // Force defense to always win the coin flip (coin < defenseRecoveryRate)
    var rng = new SplittableRandomSource(6006L);

    var eliteRecoveries = 0;
    var poorRecoveries = 0;
    var trials = 5_000;
    for (var i = 0; i < trials; i++) {
      var outcome = model.resolve(fumbler, offense, defense, rng);
      if (outcome.defenseRecovered()) {
        var recoverer = outcome.recoveredBy().get();
        if (recoverer.equals(eliteDefender.id())) {
          eliteRecoveries++;
        } else if (recoverer.equals(poorDefender.id())) {
          poorRecoveries++;
        }
      }
    }

    assertThat(eliteRecoveries)
        .as("elite-awareness defender should recover the ball far more often than poor-awareness")
        .isGreaterThan(poorRecoveries * 2);
  }

  @Test
  void resolve_eliteAwarenessOffensiveTeammate_recoversBallMoreFrequentlyThanLowAwareness() {
    // Fumbler
    var rb = player(Position.RB, "rb");
    // Elite-awareness teammate
    var eliteWr =
        aPlayer()
            .atPosition(Position.WR)
            .withDisplayName("elite-wr")
            .withSkill(aSkill().withBallCarrierVision(90))
            .withTendencies(aTendencies().withFootballIq(90))
            .build();
    // Poor-awareness teammate
    var poorWr =
        aPlayer()
            .atPosition(Position.WR)
            .withDisplayName("poor-wr")
            .withSkill(aSkill().withBallCarrierVision(10))
            .withTendencies(aTendencies().withFootballIq(10))
            .build();
    var offense = List.of(rb, eliteWr, poorWr);
    // Very weak defense — shifts coin toward offense
    var weakDefender =
        aPlayer()
            .atPosition(Position.DL)
            .withDisplayName("weak-dl")
            .withSkill(aSkill().withBlockShedding(5))
            .withTendencies(aTendencies().withFootballIq(5))
            .build();
    var defense = List.of(weakDefender);
    var fumbler = rb.id();
    var rng = new SplittableRandomSource(7007L);

    var eliteRecoveries = 0;
    var poorRecoveries = 0;
    var trials = 5_000;
    for (var i = 0; i < trials; i++) {
      var outcome = model.resolve(fumbler, offense, defense, rng);
      if (!outcome.defenseRecovered()) {
        var recoverer = outcome.recoveredBy().get();
        if (recoverer.equals(eliteWr.id())) {
          eliteRecoveries++;
        } else if (recoverer.equals(poorWr.id())) {
          poorRecoveries++;
        }
      }
    }

    assertThat(eliteRecoveries)
        .as("elite-awareness offensive teammate should recover more often than poor-awareness")
        .isGreaterThan(poorRecoveries * 2);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

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
