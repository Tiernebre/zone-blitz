/**
 * League phase state machine. Owns {@link app.zoneblitz.league.phase.LeaguePhase}, per-phase
 * ordering and day caps ({@link app.zoneblitz.league.phase.LeaguePhases}), the {@link
 * app.zoneblitz.league.phase.PhaseTransitionHandler} seam that phase-specific entry/exit logic
 * plugs into, the {@link app.zoneblitz.league.phase.AdvancePhase} use case, and the {@link
 * app.zoneblitz.league.phase.HiringPhaseAutofill} fallback for hiring phases that hit their day
 * cap.
 *
 * <p>See {@code README.md} in this directory for public API, internal seams, and extension points.
 *
 * <p>Design docs: {@code docs/technical/league-phases.md}.
 */
package app.zoneblitz.league.phase;
