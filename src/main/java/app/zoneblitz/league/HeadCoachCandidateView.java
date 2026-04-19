package app.zoneblitz.league;

import java.math.BigDecimal;
import java.util.Objects;

/**
 * Row view-model for a single HC candidate in the hiring pool table. Derived from {@link Candidate}
 * + {@link CandidatePreferences}; carries only the scouted projection — never the hidden
 * true-rating payload. {@code shortlisted} reflects the requesting franchise's shortlist
 * membership.
 */
public record HeadCoachCandidateView(
    long id,
    CandidateArchetype archetype,
    SpecialtyPosition specialty,
    int age,
    int totalExperienceYears,
    int hcYears,
    int ocYears,
    int positionCoachYears,
    String scoutedOverall,
    BigDecimal compensationTarget,
    int contractLengthTarget,
    BigDecimal guaranteedMoneyTarget,
    boolean shortlisted) {

  public HeadCoachCandidateView {
    Objects.requireNonNull(archetype, "archetype");
    Objects.requireNonNull(specialty, "specialty");
    Objects.requireNonNull(scoutedOverall, "scoutedOverall");
    Objects.requireNonNull(compensationTarget, "compensationTarget");
    Objects.requireNonNull(guaranteedMoneyTarget, "guaranteedMoneyTarget");
  }
}
