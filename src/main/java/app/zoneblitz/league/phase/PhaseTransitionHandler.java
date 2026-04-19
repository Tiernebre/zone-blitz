package app.zoneblitz.league.phase;

/**
 * Per-phase seam invoked by {@link AdvancePhase} on exit of the outgoing phase and entry of the
 * incoming phase. One implementation per {@link LeaguePhase}; registered by keying on the phase the
 * handler owns.
 *
 * <p>Handlers own phase-specific state lifecycle — candidate-pool generation on entry, autofill
 * resolution on exit, per-franchise sub-state reset, etc. None of that exists yet; the seam is
 * introduced now so hiring phases can plug in without controller/use-case churn.
 */
public interface PhaseTransitionHandler {

  /** The phase this handler owns. */
  LeaguePhase phase();

  /**
   * Called when a league is leaving this handler's {@link #phase()}. Default no-op so handlers that
   * only care about entry don't have to override.
   */
  default void onExit(long leagueId) {}

  /**
   * Called when a league is entering this handler's {@link #phase()}. Default no-op so handlers
   * that only care about exit don't have to override.
   */
  default void onEntry(long leagueId) {}
}
