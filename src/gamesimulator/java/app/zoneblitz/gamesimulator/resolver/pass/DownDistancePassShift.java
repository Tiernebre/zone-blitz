package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.role.OffensiveRole;
import app.zoneblitz.gamesimulator.role.OffensiveRoleAssignment;
import app.zoneblitz.gamesimulator.role.RoleAssignmentPair;
import app.zoneblitz.gamesimulator.roster.Player;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * Raises the log-odds of {@link PassOutcomeKind#SACK} and {@link PassOutcomeKind#INTERCEPTION} on
 * obvious-pass downs (3rd/4th and 7+). Magnitudes start from hand-tuned baselines grounded in
 * 2020-2024 nflfastR splits: sack rate ~2.5× baseline on 3rd-and-10+, interception rate ~1.5×.
 *
 * <p>The base offsets are then nudged by the offense's pass-protection and decision-making
 * attributes. A poised QB behind a strong OL turns the sack penalty down; a statue behind weak
 * protection turns it up. A high-IQ composed QB turns the INT penalty down. Both nudges are bounded
 * by {@link #MAX_SHIFT_FACTOR} so attributes can't flip the sign of the offset, and league-average
 * attributes recover the legacy {@code +1.0} / {@code +0.4} offsets exactly so the calibration
 * baseline holds.
 */
final class DownDistancePassShift implements SituationalPassShift {

  private static final int OBVIOUS_PASS_MIN_DOWN = 3;
  private static final int OBVIOUS_PASS_MIN_YARDS_TO_GO = 7;

  /** Base sack offset on obvious-pass downs at league-average attributes. */
  static final double BASE_SACK_OFFSET = 1.0;

  /** Base interception offset on obvious-pass downs at league-average attributes. */
  static final double BASE_INTERCEPTION_OFFSET = 0.4;

  /**
   * Maximum scaling either way; clamps elite/floor attributes from flipping the sign and keeps the
   * talent-axis-sweep win-rate step inside the 30pp smoothness envelope at small attribute deltas.
   */
  static final double MAX_SHIFT_FACTOR = 0.25;

  private static final Set<OffensiveRole> OL_ROLES =
      EnumSet.of(
          OffensiveRole.LT, OffensiveRole.LG, OffensiveRole.C, OffensiveRole.RG, OffensiveRole.RT);

  @Override
  public Map<PassOutcomeKind, Double> compute(GameState state, RoleAssignmentPair assignment) {
    var dd = state.downAndDistance();
    if (dd.down() < OBVIOUS_PASS_MIN_DOWN || dd.yardsToGo() < OBVIOUS_PASS_MIN_YARDS_TO_GO) {
      return Map.of();
    }
    var offense = assignment.offense();
    var sackFactor = sackFactor(offense);
    var interceptionFactor = interceptionFactor(offense);
    var offsets = new EnumMap<PassOutcomeKind, Double>(PassOutcomeKind.class);
    offsets.put(PassOutcomeKind.SACK, BASE_SACK_OFFSET * sackFactor);
    offsets.put(PassOutcomeKind.INTERCEPTION, BASE_INTERCEPTION_OFFSET * interceptionFactor);
    return Map.copyOf(offsets);
  }

  private static double sackFactor(OffensiveRoleAssignment offense) {
    var qbEdge = qbPocketEdge(offense);
    var olEdge = olProtectionEdge(offense);
    var combined = 0.5 * qbEdge + 0.5 * olEdge;
    return 1.0 - MAX_SHIFT_FACTOR * combined;
  }

  private static double interceptionFactor(OffensiveRoleAssignment offense) {
    var qb = quarterback(offense);
    if (qb == null) {
      return 1.0;
    }
    var iq = centered(qb.tendencies().footballIq());
    var composure = centered(qb.tendencies().composure());
    var combined = 0.5 * iq + 0.5 * composure;
    return 1.0 - MAX_SHIFT_FACTOR * combined;
  }

  private static double qbPocketEdge(OffensiveRoleAssignment offense) {
    var qb = quarterback(offense);
    if (qb == null) {
      return 0.0;
    }
    var pocket = centered(qb.skill().pocketPresence());
    var processing = centered(qb.tendencies().processing());
    return 0.5 * pocket + 0.5 * processing;
  }

  private static double olProtectionEdge(OffensiveRoleAssignment offense) {
    var n = 0;
    var sum = 0.0;
    for (var entry : offense.players().entrySet()) {
      if (!OL_ROLES.contains(entry.getKey())) {
        continue;
      }
      sum += centered(entry.getValue().skill().passSet());
      n++;
    }
    if (n == 0) {
      return 0.0;
    }
    return sum / n;
  }

  private static Player quarterback(OffensiveRoleAssignment offense) {
    var qb = offense.players().get(OffensiveRole.QB_POCKET);
    if (qb == null) {
      qb = offense.players().get(OffensiveRole.QB_MOVEMENT);
    }
    return qb;
  }

  private static double centered(int zeroToHundred) {
    return (zeroToHundred / 100.0 - 0.5) * 2.0;
  }
}
