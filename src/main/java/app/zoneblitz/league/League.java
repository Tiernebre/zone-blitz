package app.zoneblitz.league;

import java.time.Instant;

public record League(
    long id,
    String name,
    String ownerSubject,
    LeaguePhase phase,
    int phaseWeek,
    LeagueSettings settings,
    Instant createdAt) {}
