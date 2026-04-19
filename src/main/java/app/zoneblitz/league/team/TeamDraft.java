package app.zoneblitz.league.team;

import java.util.Optional;

/** A team to be inserted into a league. Empty owner == CPU-controlled. */
public record TeamDraft(long franchiseId, Optional<String> ownerSubject) {}
