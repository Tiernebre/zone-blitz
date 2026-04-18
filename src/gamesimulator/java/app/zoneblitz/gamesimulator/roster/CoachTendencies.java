package app.zoneblitz.gamesimulator.roster;

/**
 * Offensive coordinator tendency axes — behavioural knobs that perturb the league-average play-call
 * bands. Every axis is 0–100 and expressed as a delta against the baseline prior: 50 reproduces
 * league-average calling, 0/100 push maximally toward one end. Situation priors (down, distance,
 * score, time) always dominate the call — tendencies are nudges, not overrides.
 *
 * <p>Each axis maps to a specific lever the {@code TendencyPlayCaller} consults:
 *
 * <ul>
 *   <li>{@code passHeaviness} — shifts neutral pass rate vs the situational baseline.
 *   <li>{@code aggression} — bias toward deep shots / 4th-down go.
 *   <li>{@code paceOfPlay} — huddle vs no-huddle (clock hook; placeholder until tempo lands).
 *   <li>{@code playActionAffinity} — PA share within pass calls.
 *   <li>{@code screenAffinity} — screen share within pass calls.
 *   <li>{@code rpoAffinity} — RPO share within pass calls.
 *   <li>{@code gapRunPreference} — power/counter vs zone run mix.
 *   <li>{@code shotgunPreference} — SHOTGUN vs SINGLEBACK/PISTOL under-center mix.
 *   <li>{@code clockAwareness} — situational adjustment intensity in late-half/late-game.
 *   <li>{@code riskTolerance} — HAIL_MARY threshold, 2-pt tries, explosive-shot bias.
 * </ul>
 */
public record CoachTendencies(
    int passHeaviness,
    int aggression,
    int paceOfPlay,
    int playActionAffinity,
    int screenAffinity,
    int rpoAffinity,
    int gapRunPreference,
    int shotgunPreference,
    int clockAwareness,
    int riskTolerance) {

  public CoachTendencies {
    requireInRange(passHeaviness, "passHeaviness");
    requireInRange(aggression, "aggression");
    requireInRange(paceOfPlay, "paceOfPlay");
    requireInRange(playActionAffinity, "playActionAffinity");
    requireInRange(screenAffinity, "screenAffinity");
    requireInRange(rpoAffinity, "rpoAffinity");
    requireInRange(gapRunPreference, "gapRunPreference");
    requireInRange(shotgunPreference, "shotgunPreference");
    requireInRange(clockAwareness, "clockAwareness");
    requireInRange(riskTolerance, "riskTolerance");
  }

  /** League-average coordinator (all axes at 50). Baseline call mix. */
  public static CoachTendencies average() {
    return new CoachTendencies(50, 50, 50, 50, 50, 50, 50, 50, 50, 50);
  }

  private static void requireInRange(int value, String name) {
    if (value < 0 || value > 100) {
      throw new IllegalArgumentException(name + " must be in [0, 100], got " + value);
    }
  }
}
