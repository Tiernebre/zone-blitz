package app.zoneblitz.league;

public sealed interface AdvancePhaseResult {

  record Advanced(long leagueId, LeaguePhase from, LeaguePhase to) implements AdvancePhaseResult {}

  record NotFound(long leagueId) implements AdvancePhaseResult {}

  record NoNextPhase(long leagueId, LeaguePhase phase) implements AdvancePhaseResult {}
}
