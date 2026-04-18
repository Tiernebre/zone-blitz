package app.zoneblitz.gamesimulator.output;

import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.TeamId;
import java.util.Objects;
import java.util.Optional;

/**
 * Uniform stat line for a single player in a single game. Every field exists for every player
 * regardless of position — position-specific views are lenses over this record, not parallel types.
 */
public record PlayerGameStats(
    PlayerId player,
    GameId game,
    Optional<TeamId> team,
    int passAttempts,
    int passCompletions,
    int passYards,
    int passTds,
    int interceptions,
    int sacksTaken,
    int sackYardsLost,
    int longestCompletion,
    int rushAttempts,
    int rushYards,
    int rushTds,
    int longestRush,
    int fumbles,
    int fumblesLost,
    int targets,
    int receptions,
    int recYards,
    int recTds,
    int longestReception,
    int yardsAfterCatch,
    int drops,
    int tackles,
    int assists,
    int tacklesForLoss,
    double sacks,
    double qbHits,
    int passesDefensed,
    int defInterceptions,
    int intReturnYards,
    int intTds,
    int forcedFumbles,
    int fumbleRecoveries,
    int fumbleReturnYards,
    int defTds,
    int fgAttempts,
    int fgMade,
    int longestFg,
    int xpAttempts,
    int xpMade,
    int blockedKicks,
    int punts,
    int puntYards,
    int puntsInside20,
    int puntTouchbacks,
    int kickReturns,
    int kickReturnYards,
    int kickReturnTds,
    int puntReturns,
    int puntReturnYards,
    int puntReturnTds,
    int penalties,
    int penaltyYards,
    int snapsPlayed) {

  public PlayerGameStats {
    Objects.requireNonNull(player, "player");
    Objects.requireNonNull(game, "game");
    Objects.requireNonNull(team, "team");
  }

  /** A zeroed stat line for {@code player} in {@code game}. */
  public static PlayerGameStats empty(PlayerId player, GameId game, Optional<TeamId> team) {
    return new PlayerGameStats(
        player, game, team, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0.0, 0.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  }
}
