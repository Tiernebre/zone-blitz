package app.zoneblitz.league.hiring;

import app.zoneblitz.league.staff.SpecialtyPosition;
import java.math.BigDecimal;
import java.util.Objects;
import java.util.Optional;

/**
 * Row view-model for a single Director-of-Scouting candidate in the hiring pool table. Never
 * carries hidden-attribute data. {@code shortlisted} reflects the requesting team's shortlist
 * membership; {@code interest} is present iff the requesting team has interviewed this candidate.
 */
public record DirectorOfScoutingCandidateView(
    long id,
    String name,
    CandidateArchetype archetype,
    SpecialtyPosition specialty,
    int age,
    int totalExperienceYears,
    int dosYears,
    int scoutYears,
    int areaScoutYears,
    BigDecimal compensationTarget,
    int contractLengthTarget,
    BigDecimal guaranteedMoneyTarget,
    boolean shortlisted,
    Optional<InterviewInterest> interest) {

  public DirectorOfScoutingCandidateView {
    Objects.requireNonNull(name, "name");
    Objects.requireNonNull(archetype, "archetype");
    Objects.requireNonNull(specialty, "specialty");
    Objects.requireNonNull(compensationTarget, "compensationTarget");
    Objects.requireNonNull(guaranteedMoneyTarget, "guaranteedMoneyTarget");
    Objects.requireNonNull(interest, "interest");
  }

  public boolean interviewed() {
    return interest.isPresent();
  }
}
