package app.zoneblitz.gamesimulator.adjustments;

import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller.PlayCall;
import java.util.Objects;
import java.util.Optional;

/**
 * Default {@link GameStatsAccumulator} — pattern-matches {@link PlayEvent} variants and folds the
 * scrimmage outcomes (pass/run/sack/scramble/interception) into the offensive side's log. Pure and
 * deterministic.
 *
 * <p>NFL stat conventions:
 *
 * <ul>
 *   <li>Pass attempts include completions, incompletions, and interceptions — but <em>not</em>
 *       sacks or scrambles.
 *   <li>Pass yards count completion yardage only; sack yardage is tracked via the sack count.
 *   <li>Scrambles count as rush attempts/yards (and as a {@link PlayKind#PASS_DROPBACK} entry in
 *       the recent-play window, since the call was a pass).
 *   <li>An "explosive play" is any scrimmage gain ≥ {@link TeamPlayLog#EXPLOSIVE_THRESHOLD_YARDS}.
 * </ul>
 */
public final class RollingGameStatsAccumulator implements GameStatsAccumulator {

  @Override
  public GameStats apply(GameStats prior, PlayEvent event, Side offense, Optional<PlayCall> call) {
    Objects.requireNonNull(prior, "prior");
    Objects.requireNonNull(event, "event");
    Objects.requireNonNull(offense, "offense");
    Objects.requireNonNull(call, "call");

    var prev = prior.forOffense(offense);
    var next =
        switch (event) {
          case PlayEvent.PassComplete e -> applyPassComplete(prev, e, passKind(call));
          case PlayEvent.PassIncomplete e -> applyPassIncomplete(prev, e, passKind(call));
          case PlayEvent.Interception e -> applyInterception(prev, e, passKind(call));
          case PlayEvent.Sack e -> applySack(prev, e, passKind(call));
          case PlayEvent.Scramble e -> applyScramble(prev, e, passKind(call));
          case PlayEvent.Run e -> applyRun(prev, e);
          default -> prev;
        };
    if (next == prev) {
      return prior;
    }
    return prior.withSide(offense, next);
  }

  private static PlayKind passKind(Optional<PlayCall> call) {
    return call.map(c -> PlayKind.fromPassConcept(c.passConcept())).orElse(PlayKind.PASS_DROPBACK);
  }

  private static TeamPlayLog applyPassComplete(
      TeamPlayLog log, PlayEvent.PassComplete event, PlayKind kind) {
    var explosive = event.totalYards() >= TeamPlayLog.EXPLOSIVE_THRESHOLD_YARDS ? 1 : 0;
    return new TeamPlayLog(
            log.passAttempts() + 1,
            log.passYards() + event.totalYards(),
            log.completions() + 1,
            log.sacks(),
            log.interceptions(),
            log.rushAttempts(),
            log.rushYards(),
            log.stuffs(),
            log.explosivePlays() + explosive,
            log.playActionAttempts() + (kind == PlayKind.PASS_PLAY_ACTION ? 1 : 0),
            log.screenAttempts() + (kind == PlayKind.PASS_SCREEN ? 1 : 0),
            log.recentPlays())
        .withRecentPlay(kind);
  }

  private static TeamPlayLog applyPassIncomplete(
      TeamPlayLog log, PlayEvent.PassIncomplete event, PlayKind kind) {
    return new TeamPlayLog(
            log.passAttempts() + 1,
            log.passYards(),
            log.completions(),
            log.sacks(),
            log.interceptions(),
            log.rushAttempts(),
            log.rushYards(),
            log.stuffs(),
            log.explosivePlays(),
            log.playActionAttempts() + (kind == PlayKind.PASS_PLAY_ACTION ? 1 : 0),
            log.screenAttempts() + (kind == PlayKind.PASS_SCREEN ? 1 : 0),
            log.recentPlays())
        .withRecentPlay(kind);
  }

  private static TeamPlayLog applyInterception(
      TeamPlayLog log, PlayEvent.Interception event, PlayKind kind) {
    return new TeamPlayLog(
            log.passAttempts() + 1,
            log.passYards(),
            log.completions(),
            log.sacks(),
            log.interceptions() + 1,
            log.rushAttempts(),
            log.rushYards(),
            log.stuffs(),
            log.explosivePlays(),
            log.playActionAttempts() + (kind == PlayKind.PASS_PLAY_ACTION ? 1 : 0),
            log.screenAttempts() + (kind == PlayKind.PASS_SCREEN ? 1 : 0),
            log.recentPlays())
        .withRecentPlay(kind);
  }

  private static TeamPlayLog applySack(TeamPlayLog log, PlayEvent.Sack event, PlayKind kind) {
    return new TeamPlayLog(
            log.passAttempts(),
            log.passYards(),
            log.completions(),
            log.sacks() + 1,
            log.interceptions(),
            log.rushAttempts(),
            log.rushYards(),
            log.stuffs(),
            log.explosivePlays(),
            log.playActionAttempts() + (kind == PlayKind.PASS_PLAY_ACTION ? 1 : 0),
            log.screenAttempts() + (kind == PlayKind.PASS_SCREEN ? 1 : 0),
            log.recentPlays())
        .withRecentPlay(kind);
  }

  private static TeamPlayLog applyScramble(
      TeamPlayLog log, PlayEvent.Scramble event, PlayKind kind) {
    var yards = event.yards();
    var explosive = yards >= TeamPlayLog.EXPLOSIVE_THRESHOLD_YARDS ? 1 : 0;
    var stuff = yards <= 0 ? 1 : 0;
    return new TeamPlayLog(
            log.passAttempts(),
            log.passYards(),
            log.completions(),
            log.sacks(),
            log.interceptions(),
            log.rushAttempts() + 1,
            log.rushYards() + yards,
            log.stuffs() + stuff,
            log.explosivePlays() + explosive,
            log.playActionAttempts() + (kind == PlayKind.PASS_PLAY_ACTION ? 1 : 0),
            log.screenAttempts() + (kind == PlayKind.PASS_SCREEN ? 1 : 0),
            log.recentPlays())
        .withRecentPlay(kind);
  }

  private static TeamPlayLog applyRun(TeamPlayLog log, PlayEvent.Run event) {
    var yards = event.yards();
    var explosive = yards >= TeamPlayLog.EXPLOSIVE_THRESHOLD_YARDS ? 1 : 0;
    var stuff = yards <= 0 ? 1 : 0;
    return new TeamPlayLog(
            log.passAttempts(),
            log.passYards(),
            log.completions(),
            log.sacks(),
            log.interceptions(),
            log.rushAttempts() + 1,
            log.rushYards() + yards,
            log.stuffs() + stuff,
            log.explosivePlays() + explosive,
            log.playActionAttempts(),
            log.screenAttempts(),
            log.recentPlays())
        .withRecentPlay(PlayKind.RUN);
  }
}
