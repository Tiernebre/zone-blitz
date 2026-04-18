package app.zoneblitz.league;

public record LeagueSettings(int teamCount, int seasonGames) {

  public static LeagueSettings defaults() {
    return new LeagueSettings(8, 10);
  }
}
