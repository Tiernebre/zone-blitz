package app.zoneblitz.league.hiring;

import app.zoneblitz.league.phase.HiringStep;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.staff.TeamStaffMember;
import app.zoneblitz.league.team.TeamHiringState;

/**
 * Seam invoked on each day tick — before {@code phase_day} is incremented — to resolve every
 * candidate's active offers against their preferences. Each candidate with one or more {@link
 * OfferStatus#ACTIVE} offers accepts the highest-scoring offer; losing offers are marked {@link
 * OfferStatus#REJECTED}. When the accepted offer's team is signing, the candidate is marked hired,
 * the team's {@link TeamHiringState} transitions to {@link HiringStep#HIRED}, and a {@link
 * TeamStaffMember} row is inserted.
 *
 * <p>Ties are broken deterministically using the candidate's seeded RNG (see {@code
 * docs/technical/league-phases.md} "Offer resolution").
 *
 * <p>Idempotent: running twice on the same day is safe — there will be no remaining active offers
 * after the first run.
 */
public interface OfferResolver {

  /**
   * Resolve all active offers in the given league for the given hiring phase. {@code dayAtResolve}
   * is recorded on the resulting {@link TeamStaffMember#hiredAtDay()} — it's the phase day the
   * offers were in when they resolved, i.e. <em>before</em> the day tick increments.
   */
  void resolve(long leagueId, LeaguePhase phase, int dayAtResolve);
}
