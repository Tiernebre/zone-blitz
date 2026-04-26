package app.zoneblitz.gamesimulator.adjustments;

import app.zoneblitz.gamesimulator.event.Side;
import java.util.Objects;

/**
 * Per-game container of per-side {@link TeamPlayLog}s. Lives on {@code GameState} and is updated
 * every snap by the engine via a {@link GameStatsAccumulator}.
 *
 * <p>Each {@link TeamPlayLog} records what its team did <em>on offense</em>. The defensive
 * adjustment derivation reads {@link #forOffense(Side)} of the opposing side — i.e. "what is the
 * team I'm defending doing to me?" — while the offensive adjustment derivation reads {@link
 * #forDefense(Side)} of the opposing side similarly. Both accessors return the same
 * offense-perspective log; the directional names are sugar at the call site.
 */
public record GameStats(TeamPlayLog home, TeamPlayLog away) {

  public GameStats {
    Objects.requireNonNull(home, "home");
    Objects.requireNonNull(away, "away");
  }

  public static GameStats empty() {
    return new GameStats(TeamPlayLog.empty(), TeamPlayLog.empty());
  }

  /** The log of plays the given side ran while on offense. */
  public TeamPlayLog forOffense(Side offense) {
    Objects.requireNonNull(offense, "offense");
    return offense == Side.HOME ? home : away;
  }

  /**
   * Convenience alias for {@link #forOffense(Side)} — same semantics, different reader intent.
   * "What this side did when on offense" is the only thing the log captures; reading it as "what
   * this side allowed on defense" is a separate per-team log we do not yet record.
   */
  public TeamPlayLog forDefense(Side defense) {
    return forOffense(defense);
  }

  public GameStats withSide(Side side, TeamPlayLog log) {
    Objects.requireNonNull(side, "side");
    Objects.requireNonNull(log, "log");
    return side == Side.HOME ? new GameStats(log, away) : new GameStats(home, log);
  }

  public GameStats decay(double factor) {
    return new GameStats(home.decay(factor), away.decay(factor));
  }
}
