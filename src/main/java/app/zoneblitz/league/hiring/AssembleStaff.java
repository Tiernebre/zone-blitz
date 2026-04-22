package app.zoneblitz.league.hiring;

/**
 * Phase-entry seam for {@link app.zoneblitz.league.phase.LeaguePhase#ASSEMBLING_STAFF}. Generates
 * and hires each team's subordinate staff tree (coordinators, position coaches, scouts) by sampling
 * specialty-parameterized candidate generators biased by the team's existing HC / DoS archetypes
 * and persisting the resulting hires as {@link app.zoneblitz.league.staff.TeamStaffMember} rows.
 *
 * <p>Idempotent per-team: if a team already has at least one non-HC / non-DoS staff member, it is
 * skipped on re-entry.
 */
public interface AssembleStaff {

  /**
   * Assemble the subordinate staff tree for every team in the league.
   *
   * <p>For each un-assembled team: 1 OC + 1 DC + 1 ST coordinator, 9 position coaches (one per
   * offensive/defensive position group), 5 college scouts, 3 pro scouts. Pool rows for the three
   * candidate kinds (coordinator, position coach, scout) are upserted at the league level;
   * individual candidates are generated per-team, persisted into the matching pool, immediately
   * marked hired, and a staff row is inserted.
   *
   * @param leagueId the league to assemble staff for. If the league has no teams, the call is a
   *     no-op.
   */
  void assemble(long leagueId);
}
