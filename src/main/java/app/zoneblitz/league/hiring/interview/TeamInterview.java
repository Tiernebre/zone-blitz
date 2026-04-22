package app.zoneblitz.league.hiring.interview;

import app.zoneblitz.league.hiring.InterviewInterest;
import app.zoneblitz.league.phase.LeaguePhase;
import java.util.Objects;

/**
 * A single completed interview a team conducted against a candidate. Interviews are one-shot per
 * (team, candidate) — {@code interviewIndex} is retained for audit and will always be {@code 1}
 * today. {@code interestLevel} is computed deterministically from the candidate's preferences
 * against the team's profile and is the sole signal an interview produces.
 */
public record TeamInterview(
    long id,
    long teamId,
    long candidateId,
    LeaguePhase phase,
    int phaseDay,
    int interviewIndex,
    InterviewInterest interestLevel) {

  public TeamInterview {
    Objects.requireNonNull(phase, "phase");
    Objects.requireNonNull(interestLevel, "interestLevel");
  }
}
