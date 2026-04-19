package app.zoneblitz.league;

import java.util.List;
import java.util.Optional;

/** Feature-internal persistence seam for {@link CandidateOffer}. */
interface CandidateOfferRepository {

  /**
   * Insert a new offer in {@link OfferStatus#ACTIVE} status. A team may only have one active offer
   * on a given candidate at a time; violating the invariant raises the underlying DB constraint.
   */
  CandidateOffer insertActive(long candidateId, long teamId, String terms, int week);

  Optional<CandidateOffer> findById(long id);

  /** All offers on a candidate, ordered by submission week ascending. */
  List<CandidateOffer> findAllForCandidate(long candidateId);

  /** Active offers on a candidate. Used at offer resolution. */
  List<CandidateOffer> findActiveForCandidate(long candidateId);

  /** All active offers a team currently has outstanding. */
  List<CandidateOffer> findActiveForTeam(long teamId);

  /**
   * Transition the offer from {@link OfferStatus#ACTIVE} to the given terminal status. Returns true
   * when a row was updated.
   */
  boolean resolve(long offerId, OfferStatus status);
}
