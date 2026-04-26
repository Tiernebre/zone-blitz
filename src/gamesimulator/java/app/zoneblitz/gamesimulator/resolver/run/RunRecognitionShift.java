package app.zoneblitz.gamesimulator.resolver.run;

import app.zoneblitz.gamesimulator.resolver.run.MatchupRunResolver.RunMatchupShift;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.role.DefensiveRole;
import app.zoneblitz.gamesimulator.role.OffensiveRole;
import app.zoneblitz.gamesimulator.role.OffensiveRoleAssignment;
import app.zoneblitz.gamesimulator.roster.Player;
import java.util.EnumSet;
import java.util.Set;

/**
 * Defensive run-fit recognition shift, with a carrier vision/elusiveness offset. Mean second-level
 * {@code playRecognition} (LBs and safeties) tilts the matchup against the offense — a defense that
 * diagnoses run keys at the snap fits gaps faster, producing more stuffs and fewer breakaways. The
 * ball carrier's {@link app.zoneblitz.gamesimulator.roster.Skill#ballCarrierVision() vision} and
 * {@link app.zoneblitz.gamesimulator.roster.Skill#breakTackle() break-tackle} partially offset that
 * recognition advantage: a back who reads the same keys back at the second level can cut against
 * the grain even when the LBs diagnose correctly.
 *
 * <p>Sign: positive convention is offense advantage, so high defensive recognition contributes a
 * negative shift; high carrier elusiveness pulls the result back toward zero (or above it when the
 * defense is otherwise average). Magnitude is bounded by {@link #ENVELOPE} so it stacks under
 * role-keyed talent deltas. With league-average attributes the shift is exactly zero — baseline
 * parity is a structural invariant.
 */
public final class RunRecognitionShift implements RunMatchupShift {

  /** Maximum absolute contribution at perfectly elite (or floor) defensive recognition. */
  public static final double ENVELOPE = 0.10;

  /**
   * Weight on the carrier's vision/elusiveness offset relative to the defensive recognition signal.
   * The defense's recognition signal is centered at 0 and measured as {@code [-1, +1]}; the
   * carrier's offset moves the effective signal by up to this fraction of an axis, so a perfectly
   * elite carrier facing a perfectly elite defense halves the recognition penalty rather than
   * eliminating it.
   */
  public static final double DEFAULT_CARRIER_OFFSET_WEIGHT = 0.5;

  private static final Set<DefensiveRole> SECOND_LEVEL =
      EnumSet.of(
          DefensiveRole.MIKE_LB,
          DefensiveRole.WILL_LB,
          DefensiveRole.SAM_LB,
          DefensiveRole.STAND_UP_OLB,
          DefensiveRole.DEEP_S,
          DefensiveRole.BOX_S,
          DefensiveRole.DIME_LB);

  private final double carrierOffsetWeight;

  public RunRecognitionShift() {
    this(DEFAULT_CARRIER_OFFSET_WEIGHT);
  }

  public RunRecognitionShift(double carrierOffsetWeight) {
    this.carrierOffsetWeight = carrierOffsetWeight;
  }

  @Override
  public double compute(RunMatchupContext context, RandomSource rng) {
    var defenders = context.assignment().defense().players();
    var n = 0;
    var sum = 0.0;
    for (var entry : defenders.entrySet()) {
      if (!SECOND_LEVEL.contains(entry.getKey())) {
        continue;
      }
      sum += entry.getValue().tendencies().playRecognition();
      n++;
    }
    if (n == 0) {
      return 0.0;
    }
    var defenseSignal = (sum / n / 100.0 - 0.5) * 2.0;
    var carrierOffset = carrierElusiveness(context);
    var effective = defenseSignal - carrierOffsetWeight * carrierOffset;
    return -ENVELOPE * effective;
  }

  private static double carrierElusiveness(RunMatchupContext context) {
    var carrier = context.roles().ballCarrier().orElse(null);
    if (carrier == null) {
      carrier = pickCarrierFromAssignment(context.assignment().offense());
    }
    if (carrier == null) {
      return 0.0;
    }
    var vision = centered(carrier.skill().ballCarrierVision());
    var breakTackle = centered(carrier.skill().breakTackle());
    return 0.6 * vision + 0.4 * breakTackle;
  }

  private static Player pickCarrierFromAssignment(OffensiveRoleAssignment offense) {
    var rb = offense.players().get(OffensiveRole.RB_RUSH);
    if (rb != null) {
      return rb;
    }
    var fb = offense.players().get(OffensiveRole.FB_LEAD);
    if (fb != null) {
      return fb;
    }
    return offense.players().get(OffensiveRole.QB_POCKET);
  }

  private static double centered(int zeroToHundred) {
    return (zeroToHundred / 100.0 - 0.5) * 2.0;
  }
}
