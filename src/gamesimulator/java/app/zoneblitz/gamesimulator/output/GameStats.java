package app.zoneblitz.gamesimulator.output;

import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Top-level stats envelope: game id, both team aggregates, every player line, drive list. */
public record GameStats(
    GameId game,
    TeamGameStats home,
    TeamGameStats away,
    Map<PlayerId, PlayerGameStats> players,
    List<DriveStats> drives) {

  public GameStats {
    Objects.requireNonNull(game, "game");
    Objects.requireNonNull(home, "home");
    Objects.requireNonNull(away, "away");
    Objects.requireNonNull(players, "players");
    Objects.requireNonNull(drives, "drives");
    players = Map.copyOf(players);
    drives = List.copyOf(drives);
  }
}
