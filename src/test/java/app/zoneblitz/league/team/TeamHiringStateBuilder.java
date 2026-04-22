package app.zoneblitz.league.team;

import app.zoneblitz.league.phase.HiringStep;
import app.zoneblitz.league.phase.LeaguePhase;
import java.util.List;

/**
 * Fluent builder for {@link TeamHiringState} in test code. Defaults produce a plausible valid
 * instance (team 1 SEARCHING for a head coach with no interviewees); {@code with*} methods override
 * individual fields.
 */
final class TeamHiringStateBuilder {

  private long id = 0L;
  private long teamId = 1L;
  private LeaguePhase phase = LeaguePhase.HIRING_HEAD_COACH;
  private HiringStep step = HiringStep.SEARCHING;
  private List<Long> interviewingCandidateIds = List.of();

  static TeamHiringStateBuilder aTeamHiringState() {
    return new TeamHiringStateBuilder();
  }

  TeamHiringStateBuilder withId(long id) {
    this.id = id;
    return this;
  }

  TeamHiringStateBuilder withTeamId(long teamId) {
    this.teamId = teamId;
    return this;
  }

  TeamHiringStateBuilder withPhase(LeaguePhase phase) {
    this.phase = phase;
    return this;
  }

  TeamHiringStateBuilder withStep(HiringStep step) {
    this.step = step;
    return this;
  }

  TeamHiringStateBuilder withInterviewingCandidateIds(List<Long> interviewingCandidateIds) {
    this.interviewingCandidateIds = interviewingCandidateIds;
    return this;
  }

  TeamHiringStateBuilder withInterviewingCandidateIds(Long... interviewingCandidateIds) {
    this.interviewingCandidateIds = List.of(interviewingCandidateIds);
    return this;
  }

  TeamHiringState build() {
    return new TeamHiringState(id, teamId, phase, step, interviewingCandidateIds);
  }
}
