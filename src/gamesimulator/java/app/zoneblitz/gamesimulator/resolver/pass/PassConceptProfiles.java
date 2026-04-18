package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.roster.Skill;
import java.util.EnumMap;
import java.util.Map;
import java.util.function.ToDoubleFunction;

/**
 * Registry of {@link PassConceptProfile}s keyed by {@link PassConcept}. The {@code DROPBACK}
 * profile uses {@code 1.0 / 1.0} leg weights, reproducing the legacy "coverage − pass_rush" sum
 * exactly so baseline parity with {@code PassMatchupShift.ZERO} remains a structural invariant.
 *
 * <p>Leg weights are tuned from 2022-24 FTN-tagged pass outcomes (n≈58k): SCREEN/QUICK_GAME drop
 * pass-rush weight to near zero (&lt;0.1% sack rate vs. 14% dropback), PLAY_ACTION tilts coverage
 * up (YPA 7.5 vs. 6.1 league), HAIL_MARY goes all-in on coverage physical mismatch.
 *
 * <p>Package-private — concept profiles are an internal seam.
 */
final class PassConceptProfiles {

  private static final ToDoubleFunction<Skill> ROUTE_SKILL =
      s -> (s.routeRunning() + s.hands()) / 2.0;
  private static final ToDoubleFunction<Skill> PROTECTION_SKILL = s -> s.passSet();
  private static final ToDoubleFunction<Skill> COVERAGE_SKILL = s -> s.coverageTechnique();
  private static final ToDoubleFunction<Skill> PASS_RUSH_SKILL =
      s -> (s.passRushMoves() + s.blockShedding()) / 2.0;
  private static final ToDoubleFunction<Skill> HANDS_HEAVY_SKILL =
      s -> (s.routeRunning() + 2 * s.hands()) / 3.0;

  /** Baseline route-runner weights — speed 35, acceleration 25, agility 20, explosiveness 20. */
  private static final PassAttributeWeights BASELINE_ROUTE =
      new PassAttributeWeights(35, 25, 20, 0, 0, 0, 0, 20, ROUTE_SKILL);

  /** Baseline pass-protection weights — strength 30, power 30, agility 20, stamina 20. */
  private static final PassAttributeWeights BASELINE_PROTECTION =
      new PassAttributeWeights(0, 0, 20, 30, 30, 0, 20, 0, PROTECTION_SKILL);

  /** Baseline coverage weights — speed 35, acceleration 25, agility 25, explosiveness 15. */
  private static final PassAttributeWeights BASELINE_COVERAGE =
      new PassAttributeWeights(35, 25, 25, 0, 0, 0, 0, 15, COVERAGE_SKILL);

  /** Baseline pass-rush weights — strength 25, power 25, speed 20, bend 15, explosiveness 15. */
  private static final PassAttributeWeights BASELINE_PASS_RUSH =
      new PassAttributeWeights(20, 0, 0, 25, 25, 15, 0, 15, PASS_RUSH_SKILL);

  private static final Map<PassConcept, PassConceptProfile> PROFILES = buildProfiles();

  private PassConceptProfiles() {}

  static PassConceptProfile forConcept(PassConcept concept) {
    return PROFILES.getOrDefault(concept, PROFILES.get(PassConcept.DROPBACK));
  }

  private static Map<PassConcept, PassConceptProfile> buildProfiles() {
    var m = new EnumMap<PassConcept, PassConceptProfile>(PassConcept.class);

    // DROPBACK — baseline. 1.0/1.0 preserves legacy (coverage − pass_rush) parity.
    m.put(
        PassConcept.DROPBACK,
        new PassConceptProfile(
            1.0, 1.0, BASELINE_ROUTE, BASELINE_PROTECTION, BASELINE_COVERAGE, BASELINE_PASS_RUSH));

    // QUICK_GAME — ball out fast, protection barely matters. Coverage-tight vs. hands wins.
    var quickRoute = new PassAttributeWeights(20, 30, 25, 0, 0, 0, 0, 25, HANDS_HEAVY_SKILL);
    m.put(
        PassConcept.QUICK_GAME,
        new PassConceptProfile(
            1.1, 0.2, quickRoute, BASELINE_PROTECTION, BASELINE_COVERAGE, BASELINE_PASS_RUSH));

    // PLAY_ACTION — deeper shots, coverage leg dominates; protection still matters (back to D).
    var paRoute = new PassAttributeWeights(45, 20, 15, 0, 0, 0, 0, 20, ROUTE_SKILL);
    var paCoverage = new PassAttributeWeights(45, 20, 20, 0, 0, 0, 0, 15, COVERAGE_SKILL);
    m.put(
        PassConcept.PLAY_ACTION,
        new PassConceptProfile(
            1.3, 0.9, paRoute, BASELINE_PROTECTION, paCoverage, BASELINE_PASS_RUSH));

    // SCREEN — behind-the-line throw, pass rush irrelevant. Ball-carrier-ish after catch = hands +
    // agility.
    var screenRoute = new PassAttributeWeights(15, 30, 35, 0, 0, 0, 0, 20, HANDS_HEAVY_SKILL);
    m.put(
        PassConcept.SCREEN,
        new PassConceptProfile(
            1.0, 0.05, screenRoute, BASELINE_PROTECTION, BASELINE_COVERAGE, BASELINE_PASS_RUSH));

    // RPO — short, option read pulls defenders out of position. Low sack rate, small rush weight.
    m.put(
        PassConcept.RPO,
        new PassConceptProfile(
            1.0, 0.3, BASELINE_ROUTE, BASELINE_PROTECTION, BASELINE_COVERAGE, BASELINE_PASS_RUSH));

    // HAIL_MARY — all on coverage physical mismatch; pass rush is moot, QB is chucking it.
    var hmRoute = new PassAttributeWeights(50, 0, 0, 0, 0, 0, 0, 50, s -> s.hands());
    var hmCoverage = new PassAttributeWeights(50, 0, 0, 0, 0, 0, 0, 50, COVERAGE_SKILL);
    m.put(
        PassConcept.HAIL_MARY,
        new PassConceptProfile(
            1.5, 0.0, hmRoute, BASELINE_PROTECTION, hmCoverage, BASELINE_PASS_RUSH));

    return Map.copyOf(m);
  }
}
