package app.zoneblitz.league;

/**
 * Per-franchise hiring sub-state within a hiring phase. {@code SEARCHING} composes several
 * concurrent activities (browsing, interviewing, offering); {@code HIRED} is terminal for the
 * phase.
 */
public enum HiringStep {
  SEARCHING,
  HIRED
}
