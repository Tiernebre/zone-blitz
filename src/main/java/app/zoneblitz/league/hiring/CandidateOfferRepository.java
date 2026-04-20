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
  CandidateOffer insertActive(long candidateId, long teamId, String terms, int day);

  Optional<CandidateOffer> findById(long id);

  /** Find the active offer, if any, a team has outstanding on a specific candidate. */
  Optional<CandidateOffer> findActiveForTeamAndCandidate(long teamId, long candidateId);

  /** All offers on a candidate, ordered by submission day ascending. */
  List<CandidateOffer> findAllForCandidate(long candidateId);

  /** Active offers on a candidate. Used at offer resolution. */
  List<CandidateOffer> findActiveForCandidate(long candidateId);

  /** All active offers a team currently has outstanding. */
  List<CandidateOffer> findActiveForTeam(long teamId);

  /** All active offers in a league (joined via team), for resolver sweeps. */
  List<CandidateOffer> findActiveForLeague(long leagueId);

  /**
   * Update the terms on an ACTIVE offer and bump its revision_count and submitted_at_day. Stance is
   * reset to {@link OfferStance#PENDING} so the candidate re-reviews on the next tick.
   */
  CandidateOffer revise(long offerId, String terms, int day);

  /** Update the stance of an ACTIVE offer. */
  void setStance(long offerId, OfferStance stance);

  /**
   * Transition the offer from {@link OfferStatus#ACTIVE} to the given terminal status. Clears
   * stance. Returns true when a row was updated.
   */
  boolean resolve(long offerId, OfferStatus status);

  /**
   * All offers for a team that are still in play: status {@link OfferStatus#ACTIVE} or {@link
   * OfferStatus#COUNTER_PENDING}. Used for budget accounting and UI listings that need to surface
   * counter-pending offers alongside live ones.
   */
  List<CandidateOffer> findOutstandingForTeam(long teamId);

  /**
   * All offers in a league (joined via team) currently in {@link OfferStatus#COUNTER_PENDING}. Used
   * by the resolver sweep to expire dead counters and ask the CPU to respond.
   */
  List<CandidateOffer> findCounterPendingForLeague(long leagueId);

  /**
   * Transition an offer from {@link OfferStatus#ACTIVE} to {@link OfferStatus#COUNTER_PENDING},
   * recording the competing offer's id and the response deadline (in phase days). Stance is
   * cleared. The offer must currently be {@code ACTIVE}.
   *
   * @return the updated offer.
   */
  CandidateOffer flipToCounterPending(long offerId, long competingOfferId, int deadlineDay);

  /**
   * Accept the counter on a {@link OfferStatus#COUNTER_PENDING} offer: set new terms, clear the
   * counter metadata, return to {@link OfferStatus#ACTIVE} with stance {@link OfferStance#PENDING},
   * bump {@code revision_count}, and set {@code submitted_at_day = currentDay} so the next resolver
   * tick re-scores the offer.
   *
   * @return the updated offer.
   */
  CandidateOffer acceptCounter(long offerId, String newTermsJson, int currentDay);
}
