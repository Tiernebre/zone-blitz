package app.zoneblitz.league.hiring;

import app.zoneblitz.league.staff.SpecialtyPosition;
import java.math.BigDecimal;
import java.util.Objects;

/**
 * Row view-model for a single Director-of-Scouting candidate in the hiring pool table. Carries only
 * the scouted projection — never the hidden true-rating payload. {@code shortlisted} reflects the
 * requesting franchise's shortlist membership for the DoS phase.
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
    String scoutedOverall,
    BigDecimal compensationTarget,
    int contractLengthTarget,
    BigDecimal guaranteedMoneyTarget,
    boolean shortlisted,
    int interviewCount) {

  public DirectorOfScoutingCandidateView {
    Objects.requireNonNull(name, "name");
    Objects.requireNonNull(archetype, "archetype");
    Objects.requireNonNull(specialty, "specialty");
    Objects.requireNonNull(scoutedOverall, "scoutedOverall");
    Objects.requireNonNull(compensationTarget, "compensationTarget");
    Objects.requireNonNull(guaranteedMoneyTarget, "guaranteedMoneyTarget");
  }
}
