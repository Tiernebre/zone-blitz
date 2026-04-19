package app.zoneblitz.league;

import app.zoneblitz.league.phase.LeaguePhase;
import java.time.Instant;

public record League(
    long id,
    String name,
    String ownerSubject,
    LeaguePhase phase,
    int phaseDay,
    LeagueSettings settings,
    Instant createdAt) {}
