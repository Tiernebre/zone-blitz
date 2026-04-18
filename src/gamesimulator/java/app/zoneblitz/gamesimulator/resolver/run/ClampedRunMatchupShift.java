package app.zoneblitz.gamesimulator.resolver.run;

import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.resolver.RunRoles;
import app.zoneblitz.gamesimulator.roster.Player;
import java.util.List;
import java.util.Optional;
import java.util.function.ToDoubleFunction;

/**
 * Concept-aware, role-based run-matchup shift with physical-fit clamping.
 *
 * <p>Formula per leg (blocking-leg and carrier-leg):
 *
 * <pre>
 *   physical_gap = off_physical_score(weights) − def_physical_score(weights)
 *   floor        = −1 + 0.5 × max(0, physical_gap)
 *   ceiling      = +1 + 0.5 × min(0, physical_gap)
 *   delta        = clamp(off_skill(weights) − def_skill(weights), floor, ceiling)
 * </pre>
 *
 * <p>The result is {@code blockingLegWeight × blockingDelta + carrierLegWeight × carrierDelta},
 * where all four weight families — per-leg scalars, offensive blocker/carrier attribute mixes, and
 * defensive attribute mix — come from the {@link RunConceptProfile} chosen for the snap's {@link
 * RunConcept}. {@code INSIDE_ZONE} reproduces the legacy shift exactly, so baseline parity with
 * {@link MatchupRunResolver.RunMatchupShift#ZERO} is a structural invariant.
 *
 * <p>Defenders still sit on both legs — that's intentional: one run-defender pool handles both
 * block-defeat and downhill tackling. Concepts reshape which defensive attributes are weighted
 * (edge speed for stretch plays, interior anchor for power/sneak).
 */
public final class ClampedRunMatchupShift implements MatchupRunResolver.RunMatchupShift {

  @Override
  public double compute(RunConcept concept, RunRoles roles) {
    var profile = RunConceptProfiles.forConcept(concept);

    var blocking =
        clampedDelta(
            aggregate(roles.runBlockers(), profile.offBlockers()::skillScore),
            aggregate(roles.runDefenders(), profile.defFront()::skillScore),
            aggregate(roles.runBlockers(), p -> profile.offBlockers().physicalScore(p.physical())),
            aggregate(roles.runDefenders(), p -> profile.defFront().physicalScore(p.physical())));
    var carrier =
        clampedDelta(
            aggregate(asList(roles.ballCarrier()), profile.offCarrier()::skillScore),
            aggregate(roles.runDefenders(), profile.defFront()::skillScore),
            aggregate(
                asList(roles.ballCarrier()), p -> profile.offCarrier().physicalScore(p.physical())),
            aggregate(roles.runDefenders(), p -> profile.defFront().physicalScore(p.physical())));

    return profile.blockingLegWeight() * blocking + profile.carrierLegWeight() * carrier;
  }

  private static List<Player> asList(Optional<Player> player) {
    return player.map(List::of).orElse(List.of());
  }

  private static double clampedDelta(
      double offSkill, double defSkill, double offPhys, double defPhys) {
    var gap = offPhys - defPhys;
    var floor = -1.0 + 0.5 * Math.max(0.0, gap);
    var ceiling = 1.0 + 0.5 * Math.min(0.0, gap);
    var raw = offSkill - defSkill;
    return Math.max(floor, Math.min(ceiling, raw));
  }

  private static double aggregate(List<Player> players, ToDoubleFunction<Player> scorer) {
    if (players.isEmpty()) {
      return 0.0;
    }
    var sum = 0.0;
    for (var p : players) {
      sum += scorer.applyAsDouble(p);
    }
    return sum / players.size();
  }
}
