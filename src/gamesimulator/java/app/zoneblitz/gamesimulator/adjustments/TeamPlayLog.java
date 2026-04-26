package app.zoneblitz.gamesimulator.adjustments;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Per-side rolling stats recorded from completed scrimmage plays. Drives the in-game adjustment
 * derivations: pass/run efficiency, sack/INT counts, explosive plays, and a bounded ring of recent
 * play kinds for concept-level signals (e.g. "screen-heavy in the last 10 plays").
 *
 * <p>NFL convention for pass stats: sacks and scrambles are <em>not</em> counted as pass attempts;
 * scrambles count as rush attempts/yards. {@link #passYards} is yards gained on completions only
 * (sack yardage is tracked separately via {@link #sacks} count and not subtracted from passing
 * yards).
 *
 * <p>Counters are monotonic during accumulation; {@link #decay(double)} scales them at quarter
 * boundaries so trends fade across halves. The {@link #recentPlays} window is a fixed-size FIFO of
 * size {@link #RECENT_WINDOW}.
 */
public record TeamPlayLog(
    int passAttempts,
    int passYards,
    int completions,
    int sacks,
    int interceptions,
    int rushAttempts,
    int rushYards,
    int stuffs,
    int explosivePlays,
    int playActionAttempts,
    int screenAttempts,
    List<PlayKind> recentPlays) {

  public static final int RECENT_WINDOW = 10;
  public static final int EXPLOSIVE_THRESHOLD_YARDS = 15;

  public TeamPlayLog {
    Objects.requireNonNull(recentPlays, "recentPlays");
    recentPlays = List.copyOf(recentPlays);
  }

  public static TeamPlayLog empty() {
    return new TeamPlayLog(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, List.of());
  }

  /** Append {@code kind} to the recent-play window, evicting the oldest entry if at capacity. */
  public TeamPlayLog withRecentPlay(PlayKind kind) {
    Objects.requireNonNull(kind, "kind");
    var size = recentPlays.size();
    var dropFirst = size >= RECENT_WINDOW;
    var capacity = dropFirst ? RECENT_WINDOW : size + 1;
    var next = new ArrayList<PlayKind>(capacity);
    for (var i = dropFirst ? 1 : 0; i < size; i++) {
      next.add(recentPlays.get(i));
    }
    next.add(kind);
    return new TeamPlayLog(
        passAttempts,
        passYards,
        completions,
        sacks,
        interceptions,
        rushAttempts,
        rushYards,
        stuffs,
        explosivePlays,
        playActionAttempts,
        screenAttempts,
        next);
  }

  public double yardsPerAttempt() {
    return passAttempts == 0 ? 0.0 : (double) passYards / passAttempts;
  }

  public double yardsPerCarry() {
    return rushAttempts == 0 ? 0.0 : (double) rushYards / rushAttempts;
  }

  public double completionRate() {
    return passAttempts == 0 ? 0.0 : (double) completions / passAttempts;
  }

  public double explosiveRate() {
    var snaps = totalScrimmagePlays();
    return snaps == 0 ? 0.0 : (double) explosivePlays / snaps;
  }

  public double recentScreenShare() {
    if (recentPlays.isEmpty()) {
      return 0.0;
    }
    var screens = recentPlays.stream().filter(p -> p == PlayKind.PASS_SCREEN).count();
    return (double) screens / recentPlays.size();
  }

  public int totalScrimmagePlays() {
    return passAttempts + sacks + rushAttempts;
  }

  /**
   * Multiply all integer counters by {@code factor} (clamped to {@code [0, 1]}). The recent-play
   * window is preserved unchanged — it is bounded by count, not magnitude, so decay would be a
   * category error.
   */
  public TeamPlayLog decay(double factor) {
    if (factor >= 1.0) {
      return this;
    }
    var clamped = Math.max(0.0, factor);
    return new TeamPlayLog(
        scale(passAttempts, clamped),
        scale(passYards, clamped),
        scale(completions, clamped),
        scale(sacks, clamped),
        scale(interceptions, clamped),
        scale(rushAttempts, clamped),
        scale(rushYards, clamped),
        scale(stuffs, clamped),
        scale(explosivePlays, clamped),
        scale(playActionAttempts, clamped),
        scale(screenAttempts, clamped),
        recentPlays);
  }

  private static int scale(int value, double factor) {
    return (int) Math.round(value * factor);
  }
}
