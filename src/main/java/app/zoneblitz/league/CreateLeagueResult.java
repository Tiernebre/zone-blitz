package app.zoneblitz.league;

public sealed interface CreateLeagueResult {

  record Created(League league) implements CreateLeagueResult {}

  record NameTaken(String name) implements CreateLeagueResult {}

  record UnknownFranchise(long franchiseId) implements CreateLeagueResult {}
}
