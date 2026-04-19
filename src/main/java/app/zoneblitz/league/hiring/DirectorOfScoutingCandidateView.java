package app.zoneblitz.league.hiring;

import app.zoneblitz.league.staff.SpecialtyPosition;
import java.math.BigDecimal;
import java.util.Objects;
import java.util.Optional;

/**
 * Row view-model for a single Director-of-Scouting candidate. Never carries hidden-attribute data.
 * {@code interest} is present iff the requesting team has interviewed this candidate. {@code offer}
 * is present iff the team has an ACTIVE offer on this candidate. {@code hiredByFranchise} is
 * present iff the candidate has signed with another team.
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
    Optional<InterviewInterest> interest,
    Optional<OfferView> offer,
    Optional<String> hiredByFranchise) {

  public DirectorOfScoutingCandidateView {
    Objects.requireNonNull(name, "name");
    Objects.requireNonNull(archetype, "archetype");
    Objects.requireNonNull(specialty, "specialty");
    Objects.requireNonNull(compensationTarget, "compensationTarget");
    Objects.requireNonNull(guaranteedMoneyTarget, "guaranteedMoneyTarget");
    Objects.requireNonNull(interest, "interest");
    Objects.requireNonNull(offer, "offer");
    Objects.requireNonNull(hiredByFranchise, "hiredByFranchise");
  }

  public boolean interviewed() {
    return interest.isPresent();
  }

  public boolean hasOffer() {
    return offer.isPresent();
  }

  public boolean hiredAway() {
    return hiredByFranchise.isPresent();
  }

  public boolean canOffer() {
    return interviewed() && interest.get() != InterviewInterest.NOT_INTERESTED && !hiredAway();
  }
}
