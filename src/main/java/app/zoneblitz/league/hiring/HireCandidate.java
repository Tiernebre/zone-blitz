package app.zoneblitz.league.hiring;

/**
 * Feature-public use case for accepting a candidate's AGREED offer. Invoked when the user clicks
 * "Hire" on a candidate whose offer stance is {@link OfferStance#AGREED}. Marks the candidate
 * hired, transitions the team to {@link app.zoneblitz.league.phase.HiringStep#HIRED}, inserts the
 * {@link app.zoneblitz.league.staff.TeamStaffMember}, and REJECTs any sibling active offers from
 * other teams.
 */
public interface HireCandidate {

  HireCandidateResult hire(long leagueId, long candidateId, String ownerSubject);
}
