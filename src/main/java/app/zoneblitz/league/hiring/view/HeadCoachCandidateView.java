package app.zoneblitz.league.hiring.view;

import app.zoneblitz.league.hiring.Candidate;
import app.zoneblitz.league.hiring.CandidateArchetype;
import app.zoneblitz.league.hiring.CandidatePreferences;
import app.zoneblitz.league.hiring.InterviewInterest;
import app.zoneblitz.league.hiring.OfferView;
import app.zoneblitz.league.staff.SpecialtyPosition;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Objects;
import java.util.Optional;

/**
 * Row view-model for a single HC candidate. Derived from {@link Candidate} + {@link
 * CandidatePreferences} + the requesting team's offer (if any); never carries hidden-attribute
 * data. {@code interest} is present iff the requesting team has interviewed this candidate. {@code
 * offer} is present iff the team has an ACTIVE offer out on this candidate. {@code
 * hiredByFranchise} is present iff the candidate has signed with another team — surfaced so the
 * "Your candidates" panel can keep the row visible (with a "Hired by X" badge) instead of
 * disappearing mid-negotiation.
 */
record HeadCoachCandidateView(
    long id,
    String name,
    CandidateArchetype archetype,
    SpecialtyPosition specialty,
    int age,
    int totalExperienceYears,
    int hcYears,
    int coordinatorYears,
    int positionCoachYears,
    BigDecimal compensationTarget,
    int contractLengthTarget,
    BigDecimal guaranteedMoneyTarget,
    Optional<InterviewInterest> interest,
    Optional<OfferView> offer,
    Optional<String> hiredByFranchise,
    long remainingBudgetCents) {

  public HeadCoachCandidateView {
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

  public int guaranteedMoneyTargetPct() {
    return guaranteedMoneyTarget
        .multiply(BigDecimal.valueOf(100L))
        .setScale(0, RoundingMode.HALF_UP)
        .intValueExact();
  }
}
