package app.zoneblitz.league;

import java.time.Instant;

/** A league paired with the requesting user's controlled franchise, for home-page listing. */
public record LeagueSummary(
    long leagueId,
    String leagueName,
    LeaguePhase phase,
    int phaseWeek,
    Instant createdAt,
    long userTeamId,
    Franchise userFranchise) {}
