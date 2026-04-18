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
 */
public record GameInputs(
    GameId gameId,
    Team home,
    Team away,
    Coach homeCoach,
    Coach awayCoach,
    PreGameContext preGameContext,
    Optional<Long> seed) {

  public GameInputs {
    Objects.requireNonNull(gameId, "gameId");
    Objects.requireNonNull(home, "home");
    Objects.requireNonNull(away, "away");
    Objects.requireNonNull(homeCoach, "homeCoach");
    Objects.requireNonNull(awayCoach, "awayCoach");
    Objects.requireNonNull(preGameContext, "preGameContext");
    Objects.requireNonNull(seed, "seed");
  }

  /** Pre-game environmental + matchup context. Empty placeholder — filled in as models land. */
  public record PreGameContext() {}
}
