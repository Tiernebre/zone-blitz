package app.zoneblitz.league;

import java.time.Instant;

/** League-wide pool of candidates generated on phase entry. */
public record CandidatePool(
    long id, long leagueId, LeaguePhase phase, CandidatePoolType type, Instant generatedAt) {}
