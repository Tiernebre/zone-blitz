package app.zoneblitz.league.hiring;

/**
 * Mutual-fit signal produced by a single interview between a team and a candidate. Derived
 * deterministically from the candidate's {@link CandidatePreferences} evaluated against the team's
 * {@link app.zoneblitz.league.team.TeamProfile} — no RNG, no hidden-rating peek.
 */
public enum InterviewInterest {
  INTERESTED("Interested"),
  LUKEWARM("Lukewarm"),
  NOT_INTERESTED("Not interested");

  private final String displayName;

  InterviewInterest(String displayName) {
    this.displayName = displayName;
  }

  public String displayName() {
    return displayName;
  }
}
