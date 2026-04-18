package app.zoneblitz.league;

public sealed interface DeleteLeagueResult {

  record Deleted(long leagueId) implements DeleteLeagueResult {}

  record NotFound(long leagueId) implements DeleteLeagueResult {}
}
