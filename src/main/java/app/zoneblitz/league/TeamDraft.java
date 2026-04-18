package app.zoneblitz.league;

import java.util.Optional;

/** A team to be inserted into a league. Empty owner == CPU-controlled. */
record TeamDraft(long franchiseId, Optional<String> ownerSubject) {}
