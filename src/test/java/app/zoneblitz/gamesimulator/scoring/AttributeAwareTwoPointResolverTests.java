package app.zoneblitz.gamesimulator.scoring;

import static app.zoneblitz.gamesimulator.roster.PhysicalBuilder.aPhysical;
import static app.zoneblitz.gamesimulator.roster.PlayerBuilder.aPlayer;
import static app.zoneblitz.gamesimulator.roster.SkillBuilder.aSkill;
import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import app.zoneblitz.gamesimulator.roster.Tendencies;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AttributeAwareTwoPointResolverTests {

  private static final GameId GAME = new GameId(new UUID(0xABCDL, 0x1234L));
  private static final GameClock CLOCK = new GameClock(4, 120);
  private static final Score SCORE_AFTER_TD = new Score(6, 0);
  private static final int ITERATIONS = 10_000;

  // ------------------------------------------------------------------
  // Baseline / passthrough
  // ------------------------------------------------------------------

  @Test
  void resolve_averageRoster_successRateApproximatesBaseline() {
    TwoPointResolver resolver = new AttributeAwareTwoPointResolver(new FlatRateTwoPointResolver());

    var rate = successRate(resolver, averageTeam(), ITERATIONS);

    assertThat(rate)
        .as("average roster should stay near the 0.48 baseline within statistical noise")
        .isBetween(0.40, 0.56);
  }

  @Test
  void resolve_averageRoster_passesGuaranteedSuccessThrough() {
    TwoPointResolver resolver =
        new AttributeAwareTwoPointResolver(new FlatRateTwoPointResolver(1.0, 0.5));

    var resolved =
        resolver.resolve(
            averageTeam(),
            Side.HOME,
            GAME,
            0,
            CLOCK,
            SCORE_AFTER_TD,
            new SplittableRandomSource(7L));

    assertThat(resolved.event().success())
        .as("average roster must never flip a guaranteed-success delegate")
        .isTrue();
  }

  @Test
  void resolve_averageRoster_passesGuaranteedFailureThrough() {
    TwoPointResolver resolver =
        new AttributeAwareTwoPointResolver(new FlatRateTwoPointResolver(0.0, 0.5));

    var resolved =
        resolver.resolve(
            averageTeam(),
            Side.HOME,
            GAME,
            0,
            CLOCK,
            SCORE_AFTER_TD,
            new SplittableRandomSource(7L));

    assertThat(resolved.event().success())
        .as("average roster must never flip a guaranteed-failure delegate")
        .isFalse();
  }

  // ------------------------------------------------------------------
  // Elite offense pushes rate up
  // ------------------------------------------------------------------

  @Test
  void resolve_eliteOffense_succeedsMoreThanLeagueAverage() {
    TwoPointResolver resolver = new AttributeAwareTwoPointResolver(new FlatRateTwoPointResolver());

    var eliteRate = successRate(resolver, eliteOffenseTeam(), ITERATIONS);
    var averageRate = successRate(resolver, averageTeam(), ITERATIONS);

    assertThat(eliteRate - averageRate)
        .as("elite offense should outperform average within the shift envelope")
        .isBetween(0.02, AttributeAwareTwoPointResolver.MAX_SHIFT + 0.02);
  }

  // ------------------------------------------------------------------
  // Weak offense pushes rate down
  // ------------------------------------------------------------------

  @Test
  void resolve_weakOffense_succeedsLessThanLeagueAverage() {
    TwoPointResolver resolver = new AttributeAwareTwoPointResolver(new FlatRateTwoPointResolver());

    var weakRate = successRate(resolver, weakOffenseTeam(), ITERATIONS);
    var averageRate = successRate(resolver, averageTeam(), ITERATIONS);

    assertThat(averageRate - weakRate)
        .as("weak offense should underperform average within the shift envelope")
        .isBetween(0.02, AttributeAwareTwoPointResolver.MAX_SHIFT + 0.02);
  }

  // ------------------------------------------------------------------
  // Envelope bounds
  // ------------------------------------------------------------------

  @Test
  void resolve_eliteOffense_rateDoesNotExceedEnvelopeCeiling() {
    TwoPointResolver resolver = new AttributeAwareTwoPointResolver(new FlatRateTwoPointResolver());

    var eliteRate = successRate(resolver, eliteOffenseTeam(), ITERATIONS);

    assertThat(eliteRate)
        .as("elite offense cannot exceed baseline + MAX_SHIFT + statistical noise")
        .isLessThanOrEqualTo(
            FlatRateTwoPointResolver.DEFAULT_SUCCESS_RATE
                + AttributeAwareTwoPointResolver.MAX_SHIFT
                + 0.03);
  }

  @Test
  void resolve_weakOffense_rateDoesNotDropBelowEnvelopeFloor() {
    TwoPointResolver resolver = new AttributeAwareTwoPointResolver(new FlatRateTwoPointResolver());

    var weakRate = successRate(resolver, weakOffenseTeam(), ITERATIONS);

    assertThat(weakRate)
        .as("weak offense cannot drop below baseline - MAX_SHIFT - statistical noise")
        .isGreaterThanOrEqualTo(
            FlatRateTwoPointResolver.DEFAULT_SUCCESS_RATE
                - AttributeAwareTwoPointResolver.MAX_SHIFT
                - 0.03);
  }

  // ------------------------------------------------------------------
  // End-to-end spread
  // ------------------------------------------------------------------

  @Test
  void resolve_eliteVsWeakOffense_spreadFitsDoubleEnvelope() {
    TwoPointResolver resolver = new AttributeAwareTwoPointResolver(new FlatRateTwoPointResolver());

    var eliteRate = successRate(resolver, eliteOffenseTeam(), ITERATIONS);
    var weakRate = successRate(resolver, weakOffenseTeam(), ITERATIONS);

    assertThat(eliteRate - weakRate)
        .as("elite-vs-weak spread should fit within the double-envelope and be meaningful")
        .isBetween(0.05, 2 * AttributeAwareTwoPointResolver.MAX_SHIFT + 0.04);
  }

  // ------------------------------------------------------------------
  // Sub-score helpers
  // ------------------------------------------------------------------

  @Test
  void runCarryScore_averageRoster_isNearZero() {
    assertThat(AttributeAwareTwoPointResolver.runCarryScore(averageTeam())).isBetween(-0.05, 0.05);
  }

  @Test
  void passExecutionScore_averageRoster_isNearZero() {
    assertThat(AttributeAwareTwoPointResolver.passExecutionScore(averageTeam()))
        .isBetween(-0.05, 0.05);
  }

  @Test
  void runCarryScore_eliteRoster_isPositive() {
    assertThat(AttributeAwareTwoPointResolver.runCarryScore(eliteOffenseTeam())).isGreaterThan(0.0);
  }

  @Test
  void passExecutionScore_eliteRoster_isPositive() {
    assertThat(AttributeAwareTwoPointResolver.passExecutionScore(eliteOffenseTeam()))
        .isGreaterThan(0.0);
  }

  @Test
  void runCarryScore_rosterWithNoRbs_doesNotCrashAndReturnsAtMostZero() {
    var team =
        teamWith(
            aPlayer().atPosition(Position.QB).build(),
            aPlayer().atPosition(Position.WR).build(),
            aPlayer().atPosition(Position.OL).build());

    assertThat(AttributeAwareTwoPointResolver.runCarryScore(team)).isLessThanOrEqualTo(0.01);
  }

  @Test
  void passExecutionScore_rosterWithNoReceivers_doesNotCrashAndReturnsAtMostZero() {
    var team =
        teamWith(
            aPlayer().atPosition(Position.QB).build(),
            aPlayer().atPosition(Position.RB).build(),
            aPlayer().atPosition(Position.OL).build());

    assertThat(AttributeAwareTwoPointResolver.passExecutionScore(team)).isLessThanOrEqualTo(0.01);
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private static double successRate(TwoPointResolver resolver, Team team, int iterations) {
    var made = 0;
    for (var i = 0; i < iterations; i++) {
      var resolved =
          resolver.resolve(
              team,
              Side.HOME,
              GAME,
              i,
              CLOCK,
              SCORE_AFTER_TD,
              new SplittableRandomSource(0xDEAD_BEEFL + i));
      if (resolved.event().success()) {
        made++;
      }
    }
    return made / (double) iterations;
  }

  /** All-average (50-rated) team with standard offensive mix. */
  private static Team averageTeam() {
    var players = new ArrayList<Player>();
    players.add(aPlayer().atPosition(Position.QB).build());
    players.add(aPlayer().atPosition(Position.RB).build());
    players.add(aPlayer().atPosition(Position.WR).build());
    players.add(aPlayer().atPosition(Position.TE).build());
    for (var i = 0; i < 5; i++) {
      players.add(aPlayer().atPosition(Position.OL).build());
    }
    players.add(aPlayer().atPosition(Position.DL).build());
    players.add(aPlayer().atPosition(Position.LB).build());
    return teamWith(players);
  }

  /**
   * All key axes at 90: breakTackle, ballCarrierVision, runBlock, passSet, routeRunning, hands,
   * plus physical power/strength, and QB tendencies processing/footballIq.
   */
  private static Team eliteOffenseTeam() {
    var eliteSkill =
        aSkill()
            .withPassSet(90)
            .withRouteRunning(90)
            .withHands(90)
            .withRunBlock(90)
            .withBallCarrierVision(90)
            .withBreakTackle(90)
            .build();
    var elitePhys = aPhysical().withStrength(90).withPower(90).withExplosiveness(90).build();
    var eliteTend = new Tendencies(50, 50, 90, 90, 50, 50, 50, 50, 50);

    var players = new ArrayList<Player>();
    players.add(new Player(pid(10, 1), Position.QB, "Elite QB", elitePhys, eliteSkill, eliteTend));
    players.add(
        new Player(
            pid(10, 2), Position.RB, "Elite RB", elitePhys, eliteSkill, Tendencies.average()));
    players.add(
        new Player(
            pid(10, 3), Position.WR, "Elite WR", elitePhys, eliteSkill, Tendencies.average()));
    players.add(
        new Player(
            pid(10, 4), Position.TE, "Elite TE", elitePhys, eliteSkill, Tendencies.average()));
    for (var i = 5; i <= 9; i++) {
      players.add(
          new Player(
              pid(10, i),
              Position.OL,
              "Elite OL " + i,
              elitePhys,
              eliteSkill,
              Tendencies.average()));
    }
    players.add(aPlayer().atPosition(Position.DL).build());
    players.add(aPlayer().atPosition(Position.LB).build());
    return teamWith(players);
  }

  /**
   * All key axes at 15: breakTackle, ballCarrierVision, runBlock, passSet, routeRunning, hands,
   * plus physical power/strength, and QB tendencies processing/footballIq.
   */
  private static Team weakOffenseTeam() {
    var weakSkill =
        aSkill()
            .withPassSet(15)
            .withRouteRunning(15)
            .withHands(15)
            .withRunBlock(15)
            .withBallCarrierVision(15)
            .withBreakTackle(15)
            .build();
    var weakPhys = aPhysical().withStrength(15).withPower(15).withExplosiveness(15).build();
    var weakTend = new Tendencies(50, 50, 15, 15, 50, 50, 50, 50, 50);

    var players = new ArrayList<Player>();
    players.add(new Player(pid(20, 1), Position.QB, "Weak QB", weakPhys, weakSkill, weakTend));
    players.add(
        new Player(pid(20, 2), Position.RB, "Weak RB", weakPhys, weakSkill, Tendencies.average()));
    players.add(
        new Player(pid(20, 3), Position.WR, "Weak WR", weakPhys, weakSkill, Tendencies.average()));
    players.add(
        new Player(pid(20, 4), Position.TE, "Weak TE", weakPhys, weakSkill, Tendencies.average()));
    for (var i = 5; i <= 9; i++) {
      players.add(
          new Player(
              pid(20, i), Position.OL, "Weak OL " + i, weakPhys, weakSkill, Tendencies.average()));
    }
    players.add(aPlayer().atPosition(Position.DL).build());
    players.add(aPlayer().atPosition(Position.LB).build());
    return teamWith(players);
  }

  private static PlayerId pid(long high, long low) {
    return new PlayerId(new UUID(high, low));
  }

  private static Team teamWith(Player... players) {
    return teamWith(List.of(players));
  }

  private static Team teamWith(List<Player> players) {
    return new Team(new TeamId(new UUID(99L, 99L)), "Test", players);
  }
}
