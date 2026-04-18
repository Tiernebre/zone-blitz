package app.zoneblitz.gamesimulator.output;

import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.TeamId;
import java.time.Duration;
import java.util.Objects;

/** Per-team aggregate over a game. Derived from per-player lines plus event rollups. */
public record TeamGameStats(
    TeamId team,
    GameId game,
    int points,
    int totalYards,
    int passingYards,
    int rushingYards,
    int firstDowns,
    int thirdDownAttempts,
    int thirdDownConversions,
    int fourthDownAttempts,
    int fourthDownConversions,
    int penalties,
    int penaltyYards,
    int turnovers,
    int sacksFor,
    int sacksAgainst,
    Duration timeOfPossession,
    int redZoneAttempts,
    int redZoneScores,
    int plays) {

  public TeamGameStats {
    Objects.requireNonNull(team, "team");
    Objects.requireNonNull(game, "game");
    Objects.requireNonNull(timeOfPossession, "timeOfPossession");
  }
}
