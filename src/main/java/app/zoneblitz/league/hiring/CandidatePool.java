package app.zoneblitz.league.hiring;

import app.zoneblitz.league.phase.LeaguePhase;
import java.time.Instant;

/** League-wide pool of candidates generated on phase entry. */
public record CandidatePool(
    long id, long leagueId, LeaguePhase phase, CandidatePoolType type, Instant generatedAt) {}
