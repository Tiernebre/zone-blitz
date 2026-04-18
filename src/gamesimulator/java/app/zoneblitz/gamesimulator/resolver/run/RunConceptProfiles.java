package app.zoneblitz.gamesimulator.resolver.run;

import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.roster.Skill;
import java.util.EnumMap;
import java.util.Map;
import java.util.function.ToDoubleFunction;

/**
 * Registry of {@link RunConceptProfile}s keyed by {@link RunConcept}. The {@code INSIDE_ZONE}
 * profile reproduces the legacy weights exactly, so baseline parity with {@code RunMatchupShift
 * .ZERO} remains a structural invariant. Other concepts tilt the blocking/carrier leg balance and
 * the per-axis physical/skill mixes to reflect scheme intent.
 *
 * <p>Unknown concepts fall back to {@code INSIDE_ZONE}. {@code OTHER} is also a baseline
 * passthrough since it carries no scheme signal.
 *
 * <p>Package-private — concept profiles are an internal seam.
 */
final class RunConceptProfiles {

  private static final ToDoubleFunction<Skill> CARRIER_SKILL =
      s -> (s.ballCarrierVision() + s.breakTackle()) / 2.0;
  private static final ToDoubleFunction<Skill> BLOCKER_SKILL = s -> s.runBlock();
  private static final ToDoubleFunction<Skill> DEFENDER_SKILL =
      s -> (s.tackling() + s.blockShedding()) / 2.0;
  private static final ToDoubleFunction<Skill> SHED_HEAVY_SKILL =
      s -> (s.tackling() + 2 * s.blockShedding()) / 3.0;
  private static final ToDoubleFunction<Skill> TACKLE_HEAVY_SKILL =
      s -> (2 * s.tackling() + s.blockShedding()) / 3.0;

  /** Baseline carrier weights — speed 25, agility 25, explosive 20, power 15, strength 15. */
  private static final RunAttributeWeights BASELINE_CARRIER =
      new RunAttributeWeights(25, 0, 25, 15, 15, 0, 0, 20, CARRIER_SKILL);

  /** Baseline blocker weights — strength 30, power 30, agility 20, stamina 20. */
  private static final RunAttributeWeights BASELINE_BLOCKERS =
      new RunAttributeWeights(0, 0, 20, 30, 30, 0, 20, 0, BLOCKER_SKILL);

  /** Baseline defender weights — strength 25, power 20, speed 20, agility 20, explosive 15. */
  private static final RunAttributeWeights BASELINE_DEF =
      new RunAttributeWeights(20, 0, 20, 25, 20, 0, 0, 15, DEFENDER_SKILL);

  private static final Map<RunConcept, RunConceptProfile> PROFILES = buildProfiles();

  private RunConceptProfiles() {}

  static RunConceptProfile forConcept(RunConcept concept) {
    return PROFILES.getOrDefault(concept, PROFILES.get(RunConcept.INSIDE_ZONE));
  }

  private static Map<RunConcept, RunConceptProfile> buildProfiles() {
    var m = new EnumMap<RunConcept, RunConceptProfile>(RunConcept.class);

    m.put(
        RunConcept.INSIDE_ZONE,
        new RunConceptProfile(1.0, 1.0, BASELINE_BLOCKERS, BASELINE_CARRIER, BASELINE_DEF));

    // POWER / TRAP — blocking-heavy interior maul; anchor strength is what defense is measured on.
    var powerBlockers = new RunAttributeWeights(0, 0, 10, 40, 35, 0, 15, 0, BLOCKER_SKILL);
    var powerCarrier =
        new RunAttributeWeights(
            15,
            0,
            15,
            25,
            25,
            0,
            0,
            20,
            s -> (s.breakTackle() + s.ballCarrierVision() + s.breakTackle()) / 3.0);
    var powerDef = new RunAttributeWeights(10, 0, 15, 35, 25, 0, 0, 15, TACKLE_HEAVY_SKILL);
    m.put(RunConcept.POWER, new RunConceptProfile(1.3, 0.8, powerBlockers, powerCarrier, powerDef));
    m.put(RunConcept.TRAP, new RunConceptProfile(1.2, 0.9, powerBlockers, powerCarrier, powerDef));

    // COUNTER — pulling guards need agility + power; defense is measured on discipline (shed).
    var counterBlockers = new RunAttributeWeights(10, 0, 30, 25, 20, 0, 15, 0, BLOCKER_SKILL);
    var counterCarrier = new RunAttributeWeights(20, 0, 25, 15, 15, 0, 0, 25, CARRIER_SKILL);
    var counterDef = new RunAttributeWeights(15, 0, 25, 25, 15, 0, 0, 20, SHED_HEAVY_SKILL);
    m.put(
        RunConcept.COUNTER,
        new RunConceptProfile(1.1, 1.0, counterBlockers, counterCarrier, counterDef));

    // OUTSIDE_ZONE / SWEEP — edge speed on both sides; carrier leg matters more.
    var stretchBlockers = new RunAttributeWeights(20, 0, 35, 10, 10, 0, 25, 0, BLOCKER_SKILL);
    var stretchCarrier = new RunAttributeWeights(35, 0, 30, 5, 5, 0, 0, 25, CARRIER_SKILL);
    var stretchDef = new RunAttributeWeights(35, 0, 25, 10, 10, 0, 0, 20, TACKLE_HEAVY_SKILL);
    m.put(
        RunConcept.OUTSIDE_ZONE,
        new RunConceptProfile(0.9, 1.2, stretchBlockers, stretchCarrier, stretchDef));
    m.put(
        RunConcept.SWEEP,
        new RunConceptProfile(0.8, 1.3, stretchBlockers, stretchCarrier, stretchDef));

    // DRAW / QB_DRAW — carrier-dominant vs. a pass-rushing front.
    var drawBlockers = new RunAttributeWeights(10, 0, 25, 25, 20, 0, 20, 0, BLOCKER_SKILL);
    var drawCarrier = new RunAttributeWeights(25, 0, 25, 10, 15, 0, 0, 25, CARRIER_SKILL);
    var drawDef = new RunAttributeWeights(25, 0, 25, 15, 15, 0, 0, 20, SHED_HEAVY_SKILL);
    m.put(RunConcept.DRAW, new RunConceptProfile(0.7, 1.3, drawBlockers, drawCarrier, drawDef));
    m.put(RunConcept.QB_DRAW, new RunConceptProfile(0.7, 1.3, drawBlockers, drawCarrier, drawDef));

    // QB_SNEAK — interior leverage is nearly everything.
    var sneakBlockers = new RunAttributeWeights(0, 0, 5, 45, 40, 0, 10, 0, BLOCKER_SKILL);
    var sneakCarrier =
        new RunAttributeWeights(
            5, 0, 5, 40, 40, 0, 0, 10, s -> (s.breakTackle() + s.ballCarrierVision()) / 2.0);
    var sneakDef = new RunAttributeWeights(0, 0, 5, 50, 35, 0, 0, 10, TACKLE_HEAVY_SKILL);
    m.put(
        RunConcept.QB_SNEAK,
        new RunConceptProfile(1.5, 0.5, sneakBlockers, sneakCarrier, sneakDef));

    m.put(
        RunConcept.OTHER,
        new RunConceptProfile(1.0, 1.0, BASELINE_BLOCKERS, BASELINE_CARRIER, BASELINE_DEF));

    return Map.copyOf(m);
  }
}
