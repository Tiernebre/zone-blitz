package app.zoneblitz.league.hiring;

import java.util.List;
import java.util.Optional;

/** Feature-internal persistence seam for {@link CandidateOffer}. */
public interface CandidateOfferRepository {

  /**
   * Insert a new offer in {@link OfferStatus#ACTIVE} status with {@link OfferStance#PENDING}. A
   * team may only have one active offer on a given candidate at a time; violating the invariant
   * raises the underlying DB constraint.
   */
  CandidateOffer insertActive(long candidateId, long teamId, String terms, int week);

  Optional<CandidateOffer> findById(long id);

  /** Find the active offer, if any, a team has outstanding on a specific candidate. */
  Optional<CandidateOffer> findActiveForTeamAndCandidate(long teamId, long candidateId);

  /** All offers on a candidate, ordered by submission week ascending. */
  List<CandidateOffer> findAllForCandidate(long candidateId);

  /** Active offers on a candidate. Used at offer resolution. */
  List<CandidateOffer> findActiveForCandidate(long candidateId);

  /** All active offers a team currently has outstanding. */
  List<CandidateOffer> findActiveForTeam(long teamId);

  /** All active offers in a league (joined via team), for resolver sweeps. */
  List<CandidateOffer> findActiveForLeague(long leagueId);

  /**
   * Update the terms on an ACTIVE offer and bump its revision_count and submitted_at_week. Stance
   * is reset to {@link OfferStance#PENDING} so the candidate re-reviews on the next tick.
   */
  CandidateOffer revise(long offerId, String terms, int week);

  /** Update the stance of an ACTIVE offer. */
  void setStance(long offerId, OfferStance stance);

  /**
   * Transition the offer from {@link OfferStatus#ACTIVE} to the given terminal status. Clears
   * stance. Returns true when a row was updated.
   */
  boolean resolve(long offerId, OfferStatus status);
}
