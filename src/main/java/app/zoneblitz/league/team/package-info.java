/**
 * Team aggregate: 8 teams per league, one user-owned plus seven CPU-controlled. Owns the team
 * insert path used by league creation, the city/franchise-sourced {@link
 * app.zoneblitz.league.team.TeamProfile} read seam consumed by offer scoring, the per-team hiring
 * sub-state, and the {@link app.zoneblitz.league.team.CpuTeamStrategy} seam invoked by {@code
 * AdvanceDay} on every day tick for CPU teams.
 *
 * <p>See {@code README.md} in this directory for public API, internal seams, and extension points.
 *
 * <p>Design docs: {@code docs/technical/league-phases.md}.
 */
package app.zoneblitz.league.team;
