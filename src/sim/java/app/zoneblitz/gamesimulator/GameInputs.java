package app.zoneblitz.gamesimulator;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * All inputs required to simulate a single game. For F1 the rosters and coach identifiers are
 * placeholders; later tasks will expand {@link PreGameContext} and the roster shape.
 */
public record GameInputs(
    GameId gameId,
    TeamId homeTeam,
    TeamId awayTeam,
    List<PlayerId> homeRoster,
    List<PlayerId> awayRoster,
    PlayerId homeCoach,
    PlayerId awayCoach,
    PreGameContext preGameContext,
    Optional<Long> seed) {

  public GameInputs {
    Objects.requireNonNull(gameId, "gameId");
    Objects.requireNonNull(homeTeam, "homeTeam");
    Objects.requireNonNull(awayTeam, "awayTeam");
    Objects.requireNonNull(homeRoster, "homeRoster");
    Objects.requireNonNull(awayRoster, "awayRoster");
    Objects.requireNonNull(homeCoach, "homeCoach");
    Objects.requireNonNull(awayCoach, "awayCoach");
    Objects.requireNonNull(preGameContext, "preGameContext");
    Objects.requireNonNull(seed, "seed");
    homeRoster = List.copyOf(homeRoster);
    awayRoster = List.copyOf(awayRoster);
  }

  /** Pre-game environmental + matchup context. Empty for F1; filled in by later tasks. */
  public record PreGameContext() {}
}
