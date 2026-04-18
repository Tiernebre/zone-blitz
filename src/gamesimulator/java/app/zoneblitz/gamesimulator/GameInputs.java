package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.roster.Coach;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.Objects;
import java.util.Optional;

/**
 * All inputs required to simulate a single game. Rosters and coaches are pre-fetched by the caller
 * from the roster feature's public use case — the sim never touches persistence. {@link
 * PreGameContext} is a stub today; later tasks fill in weather, surface, and home-field context.
 *
 * <p>{@link #gameType()} drives overtime rules: regular-season games use modified sudden death with
 * a single 10-minute period that may end tied; playoff games play indefinite 15-minute sudden-death
 * periods until a winner is determined.
 */
public record GameInputs(
    GameId gameId,
    Team home,
    Team away,
    Coach homeCoach,
    Coach awayCoach,
    PreGameContext preGameContext,
    GameType gameType,
    Optional<Long> seed) {

  public GameInputs {
    Objects.requireNonNull(gameId, "gameId");
    Objects.requireNonNull(home, "home");
    Objects.requireNonNull(away, "away");
    Objects.requireNonNull(homeCoach, "homeCoach");
    Objects.requireNonNull(awayCoach, "awayCoach");
    Objects.requireNonNull(preGameContext, "preGameContext");
    Objects.requireNonNull(gameType, "gameType");
    Objects.requireNonNull(seed, "seed");
  }

  /**
   * Convenience constructor that defaults {@link #gameType()} to {@link GameType#REGULAR_SEASON}.
   */
  public GameInputs(
      GameId gameId,
      Team home,
      Team away,
      Coach homeCoach,
      Coach awayCoach,
      PreGameContext preGameContext,
      Optional<Long> seed) {
    this(gameId, home, away, homeCoach, awayCoach, preGameContext, GameType.REGULAR_SEASON, seed);
  }

  /**
   * Pre-game environmental + matchup context. Carries the home team's {@link HomeFieldAdvantage};
   * weather, surface, and injury priors land here as those models come online.
   */
  public record PreGameContext(HomeFieldAdvantage homeFieldAdvantage) {

    public PreGameContext {
      Objects.requireNonNull(homeFieldAdvantage, "homeFieldAdvantage");
    }

    /** Convenience constructor — defaults to neutral home field (no shift applied). */
    public PreGameContext() {
      this(HomeFieldAdvantage.neutral());
    }
  }
}
