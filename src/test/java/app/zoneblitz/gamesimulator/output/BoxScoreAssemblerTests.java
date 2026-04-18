package app.zoneblitz.gamesimulator.output;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldGoalResult;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.FumbleOutcome;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.IncompleteReason;
import app.zoneblitz.gamesimulator.event.PatResult;
import app.zoneblitz.gamesimulator.event.PenaltyType;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.PuntResult;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.event.TeamId;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class BoxScoreAssemblerTests {

  private static final GameId GAME = new GameId(new UUID(0, 42));
  private static final TeamId HOME = new TeamId(new UUID(1, 1));
  private static final TeamId AWAY = new TeamId(new UUID(2, 2));
  private static final PlayerId HOME_QB = new PlayerId(new UUID(10, 10));
  private static final PlayerId HOME_WR = new PlayerId(new UUID(10, 11));
  private static final PlayerId HOME_RB = new PlayerId(new UUID(10, 12));
  private static final PlayerId HOME_K = new PlayerId(new UUID(10, 13));
  private static final PlayerId HOME_P = new PlayerId(new UUID(10, 14));
  private static final PlayerId AWAY_CB = new PlayerId(new UUID(20, 20));
  private static final PlayerId AWAY_DE = new PlayerId(new UUID(20, 21));
  private static final PlayerId AWAY_RET = new PlayerId(new UUID(20, 22));
  private static final DownAndDistance DD = new DownAndDistance(1, 10);
  private static final FieldPosition SPOT = new FieldPosition(25);
  private static final GameClock CLOCK = new GameClock(1, 900);

  private final StatsAssembler assembler = new BoxScoreAssembler();
  private final TeamAssignment assignment =
      new TeamAssignment(
          HOME,
          AWAY,
          Map.of(
              HOME_QB, HOME,
              HOME_WR, HOME,
              HOME_RB, HOME,
              HOME_K, HOME,
              HOME_P, HOME,
              AWAY_CB, AWAY,
              AWAY_DE, AWAY,
              AWAY_RET, AWAY));

  @Test
  void passComplete_creditsQbAndTargetPerFormula() {
    var stats = finalize(passComplete(0, HOME_QB, HOME_WR, 8, 4, 12, false, true));

    var qb = stats.players().get(HOME_QB);
    assertThat(qb.passAttempts()).isEqualTo(1);
    assertThat(qb.passCompletions()).isEqualTo(1);
    assertThat(qb.passYards()).isEqualTo(12);
    assertThat(qb.longestCompletion()).isEqualTo(12);

    var wr = stats.players().get(HOME_WR);
    assertThat(wr.targets()).isEqualTo(1);
    assertThat(wr.receptions()).isEqualTo(1);
    assertThat(wr.recYards()).isEqualTo(12);
    assertThat(wr.yardsAfterCatch()).isEqualTo(4);
  }

  @Test
  void passingYards_sumsAirPlusYacAcrossCompletions() {
    var stats =
        finalize(
            passComplete(0, HOME_QB, HOME_WR, 10, 5, 15, false, true),
            passComplete(1, HOME_QB, HOME_WR, 7, 0, 7, true, true),
            passComplete(2, HOME_QB, HOME_WR, 20, 6, 26, false, false));

    var qb = stats.players().get(HOME_QB);
    assertThat(qb.passYards()).isEqualTo(15 + 7 + 26);
    assertThat(qb.passTds()).isEqualTo(1);
    assertThat(qb.longestCompletion()).isEqualTo(26);
    var wr = stats.players().get(HOME_WR);
    assertThat(wr.recYards()).isEqualTo(48);
    assertThat(wr.recTds()).isEqualTo(1);
  }

  @Test
  void rushingYards_sumsAcrossRuns() {
    var stats =
        finalize(run(0, HOME_RB, 5, false), run(1, HOME_RB, 12, true), run(2, HOME_RB, -1, false));

    var rb = stats.players().get(HOME_RB);
    assertThat(rb.rushAttempts()).isEqualTo(3);
    assertThat(rb.rushYards()).isEqualTo(16);
    assertThat(rb.rushTds()).isEqualTo(1);
    assertThat(rb.longestRush()).isEqualTo(12);
  }

  @Test
  void teamTotals_equalSumOfPlayerTotals() {
    var stats =
        finalize(
            passComplete(0, HOME_QB, HOME_WR, 10, 5, 15, false, true),
            run(1, HOME_RB, 7, false),
            run(2, HOME_RB, 3, false));

    var home = stats.home();
    var expectedPass = stats.players().get(HOME_QB).passYards();
    var expectedRush = stats.players().get(HOME_RB).rushYards();
    assertThat(home.passingYards()).isEqualTo(expectedPass);
    assertThat(home.rushingYards()).isEqualTo(expectedRush);
    assertThat(home.totalYards()).isEqualTo(expectedPass + expectedRush);
  }

  @Test
  void interception_chargesQbAndCreditsInterceptor() {
    var stats = finalize(interception(0, HOME_QB, HOME_WR, AWAY_CB, 20, true));

    assertThat(stats.players().get(HOME_QB).passAttempts()).isEqualTo(1);
    assertThat(stats.players().get(HOME_QB).interceptions()).isEqualTo(1);
    assertThat(stats.players().get(AWAY_CB).defInterceptions()).isEqualTo(1);
    assertThat(stats.players().get(AWAY_CB).intReturnYards()).isEqualTo(20);
    assertThat(stats.players().get(AWAY_CB).intTds()).isEqualTo(1);
    assertThat(stats.home().turnovers()).isEqualTo(1);
  }

  @Test
  void sack_sharedAmongSackersAndSackYardsCountedOnQb() {
    var stats = finalize(sack(0, HOME_QB, List.of(AWAY_DE, AWAY_CB), 7));

    assertThat(stats.players().get(HOME_QB).sacksTaken()).isEqualTo(1);
    assertThat(stats.players().get(HOME_QB).sackYardsLost()).isEqualTo(7);
    assertThat(stats.players().get(AWAY_DE).sacks()).isEqualTo(0.5);
    assertThat(stats.players().get(AWAY_CB).sacks()).isEqualTo(0.5);
    assertThat(stats.home().sacksAgainst()).isEqualTo(7);
    assertThat(stats.away().sacksFor()).isEqualTo(1);
  }

  @Test
  void passIncompleteDropped_chargesDropAndNoCompletion() {
    var stats =
        finalize(passIncomplete(0, HOME_QB, HOME_WR, IncompleteReason.DROPPED, Optional.empty()));

    assertThat(stats.players().get(HOME_QB).passAttempts()).isEqualTo(1);
    assertThat(stats.players().get(HOME_QB).passCompletions()).isZero();
    assertThat(stats.players().get(HOME_WR).drops()).isEqualTo(1);
  }

  @Test
  void passIncompleteBrokenUp_creditsPassDefensedToDefender() {
    var stats =
        finalize(
            passIncomplete(0, HOME_QB, HOME_WR, IncompleteReason.BROKEN_UP, Optional.of(AWAY_CB)));

    assertThat(stats.players().get(AWAY_CB).passesDefensed()).isEqualTo(1);
  }

  @Test
  void fieldGoalMade_updatesKickerAndEndsDriveAsFg() {
    var stats = finalize(fieldGoal(0, HOME_K, 42, FieldGoalResult.GOOD));

    var k = stats.players().get(HOME_K);
    assertThat(k.fgAttempts()).isEqualTo(1);
    assertThat(k.fgMade()).isEqualTo(1);
    assertThat(k.longestFg()).isEqualTo(42);
    assertThat(stats.drives()).hasSize(1);
    assertThat(stats.drives().getFirst().result()).isEqualTo(DriveResult.FG);
  }

  @Test
  void extraPoint_doesNotCountAsPlayButCreditsKicker() {
    var stats =
        finalize(
            passComplete(0, HOME_QB, HOME_WR, 10, 5, 15, true, true),
            extraPoint(1, HOME_K, PatResult.GOOD));

    var k = stats.players().get(HOME_K);
    assertThat(k.xpAttempts()).isEqualTo(1);
    assertThat(k.xpMade()).isEqualTo(1);
    assertThat(stats.home().plays()).isEqualTo(1);
  }

  @Test
  void punt_creditsPunterAndReturner() {
    var stats = finalize(punt(0, HOME_P, 48, Optional.of(AWAY_RET), 9, PuntResult.RETURNED));

    assertThat(stats.players().get(HOME_P).punts()).isEqualTo(1);
    assertThat(stats.players().get(HOME_P).puntYards()).isEqualTo(48);
    assertThat(stats.players().get(AWAY_RET).puntReturns()).isEqualTo(1);
    assertThat(stats.players().get(AWAY_RET).puntReturnYards()).isEqualTo(9);
  }

  @Test
  void penalty_creditsOffenderAndRollsUpToTeam() {
    var stats = finalize(penalty(0, PenaltyType.FALSE_START, Side.HOME, HOME_WR, 5));

    assertThat(stats.players().get(HOME_WR).penalties()).isEqualTo(1);
    assertThat(stats.players().get(HOME_WR).penaltyYards()).isEqualTo(5);
    assertThat(stats.home().penalties()).isEqualTo(1);
    assertThat(stats.home().penaltyYards()).isEqualTo(5);
  }

  @Test
  void fumbleLost_chargesFumblerAndCreditsRecoverer() {
    var stats =
        finalize(
            runWithFumble(
                0, HOME_RB, 3, new FumbleOutcome(HOME_RB, true, Optional.of(AWAY_DE), 15)));

    assertThat(stats.players().get(HOME_RB).fumbles()).isEqualTo(1);
    assertThat(stats.players().get(HOME_RB).fumblesLost()).isEqualTo(1);
    assertThat(stats.players().get(AWAY_DE).fumbleRecoveries()).isEqualTo(1);
    assertThat(stats.players().get(AWAY_DE).fumbleReturnYards()).isEqualTo(15);
    assertThat(stats.home().turnovers()).isEqualTo(1);
  }

  @Test
  void points_derivedFromLastEventScore() {
    var stats =
        finalize(
            passComplete(0, HOME_QB, HOME_WR, 10, 5, 15, false, true, new Score(0, 0)),
            run(1, HOME_RB, 8, true, new Score(6, 0)),
            extraPointWithScore(2, HOME_K, PatResult.GOOD, new Score(7, 0)));

    assertThat(stats.home().points()).isEqualTo(7);
    assertThat(stats.away().points()).isZero();
  }

  private GameStats finalize(PlayEvent... events) {
    return assembler.finalize(GAME, assignment, java.util.stream.Stream.of(events));
  }

  private static PlayEvent.PassComplete passComplete(
      int seq,
      PlayerId qb,
      PlayerId target,
      int air,
      int yac,
      int total,
      boolean td,
      boolean firstDown) {
    return passComplete(seq, qb, target, air, yac, total, td, firstDown, new Score(0, 0));
  }

  private static PlayEvent.PassComplete passComplete(
      int seq,
      PlayerId qb,
      PlayerId target,
      int air,
      int yac,
      int total,
      boolean td,
      boolean firstDown,
      Score scoreAfter) {
    return new PlayEvent.PassComplete(
        PlayId.random(),
        GAME,
        seq,
        DD,
        SPOT,
        CLOCK,
        CLOCK,
        scoreAfter,
        qb,
        target,
        air,
        yac,
        total,
        new FieldPosition(SPOT.yardLine() + total),
        Optional.empty(),
        List.of(),
        td,
        firstDown);
  }

  private static PlayEvent.PassIncomplete passIncomplete(
      int seq, PlayerId qb, PlayerId target, IncompleteReason reason, Optional<PlayerId> defender) {
    return new PlayEvent.PassIncomplete(
        PlayId.random(),
        GAME,
        seq,
        DD,
        SPOT,
        CLOCK,
        CLOCK,
        new Score(0, 0),
        qb,
        target,
        0,
        reason,
        defender);
  }

  private static PlayEvent.Sack sack(int seq, PlayerId qb, List<PlayerId> sackers, int yardsLost) {
    return new PlayEvent.Sack(
        PlayId.random(),
        GAME,
        seq,
        DD,
        SPOT,
        CLOCK,
        CLOCK,
        new Score(0, 0),
        qb,
        sackers,
        yardsLost,
        Optional.empty());
  }

  private static PlayEvent.Run run(int seq, PlayerId carrier, int yards, boolean td) {
    return run(seq, carrier, yards, td, new Score(0, 0));
  }

  private static PlayEvent.Run run(int seq, PlayerId carrier, int yards, boolean td, Score s) {
    return new PlayEvent.Run(
        PlayId.random(),
        GAME,
        seq,
        DD,
        SPOT,
        CLOCK,
        CLOCK,
        s,
        carrier,
        RunConcept.INSIDE_ZONE,
        yards,
        new FieldPosition(SPOT.yardLine() + yards),
        Optional.empty(),
        Optional.empty(),
        td,
        false,
        0L);
  }

  private static PlayEvent.Run runWithFumble(
      int seq, PlayerId carrier, int yards, FumbleOutcome fumble) {
    return new PlayEvent.Run(
        PlayId.random(),
        GAME,
        seq,
        DD,
        SPOT,
        CLOCK,
        CLOCK,
        new Score(0, 0),
        carrier,
        RunConcept.INSIDE_ZONE,
        yards,
        new FieldPosition(SPOT.yardLine() + yards),
        Optional.empty(),
        Optional.of(fumble),
        false,
        false,
        0L);
  }

  private static PlayEvent.Interception interception(
      int seq,
      PlayerId qb,
      PlayerId intendedTarget,
      PlayerId interceptor,
      int returnYards,
      boolean td) {
    return new PlayEvent.Interception(
        PlayId.random(),
        GAME,
        seq,
        DD,
        SPOT,
        CLOCK,
        CLOCK,
        new Score(0, 0),
        qb,
        intendedTarget,
        interceptor,
        returnYards,
        SPOT,
        td);
  }

  private static PlayEvent.FieldGoalAttempt fieldGoal(
      int seq, PlayerId kicker, int distance, FieldGoalResult result) {
    return new PlayEvent.FieldGoalAttempt(
        PlayId.random(),
        GAME,
        seq,
        DD,
        SPOT,
        CLOCK,
        CLOCK,
        new Score(0, 0),
        kicker,
        distance,
        result,
        Optional.empty());
  }

  private static PlayEvent.ExtraPoint extraPoint(int seq, PlayerId kicker, PatResult result) {
    return extraPointWithScore(seq, kicker, result, new Score(0, 0));
  }

  private static PlayEvent.ExtraPoint extraPointWithScore(
      int seq, PlayerId kicker, PatResult result, Score s) {
    return new PlayEvent.ExtraPoint(
        PlayId.random(), GAME, seq, DD, SPOT, CLOCK, CLOCK, s, kicker, result);
  }

  private static PlayEvent.Punt punt(
      int seq,
      PlayerId punter,
      int gross,
      Optional<PlayerId> returner,
      int returnYards,
      PuntResult result) {
    return new PlayEvent.Punt(
        PlayId.random(),
        GAME,
        seq,
        DD,
        SPOT,
        CLOCK,
        CLOCK,
        new Score(0, 0),
        punter,
        gross,
        returner,
        returnYards,
        result);
  }

  private static PlayEvent.Penalty penalty(
      int seq, PenaltyType type, Side against, PlayerId who, int yards) {
    return new PlayEvent.Penalty(
        PlayId.random(),
        GAME,
        seq,
        DD,
        SPOT,
        CLOCK,
        CLOCK,
        new Score(0, 0),
        type,
        against,
        who,
        yards,
        true,
        Optional.empty());
  }
}
