package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.GameState;
import java.util.EnumMap;
import java.util.Map;

/**
 * Raises the log-odds of {@link PassOutcomeKind#SACK} and {@link PassOutcomeKind#INTERCEPTION} on
 * obvious-pass downs (3rd/4th and 7+). Magnitudes are hand-tuned starting points grounded in
 * 2020-2024 nflfastR splits: sack rate ~2.5× baseline on 3rd-and-10+, interception rate ~1.5×.
 * These values live here rather than in a band file because they describe a scalar corner of the
 * outcome-mix shape, not a ladder — a JSON round-trip adds plumbing without adding signal.
 */
final class DownDistancePassShift implements SituationalPassShift {

  private static final int OBVIOUS_PASS_MIN_DOWN = 3;

  private static final int OBVIOUS_PASS_MIN_YARDS_TO_GO = 7;

  private static final Map<PassOutcomeKind, Double> OBVIOUS_PASS_OFFSETS;

  static {
    var offsets = new EnumMap<PassOutcomeKind, Double>(PassOutcomeKind.class);
    // +1.0 logit ≈ sack odds × e ≈ 2.7× baseline; with renormalization the probability
    // of a sack on 3rd-and-10 roughly doubles, matching published pbp splits.
    offsets.put(PassOutcomeKind.SACK, 1.0);
    // +0.4 logit ≈ INT odds × 1.5× baseline — coverage-heavy fronts generate more picks.
    offsets.put(PassOutcomeKind.INTERCEPTION, 0.4);
    OBVIOUS_PASS_OFFSETS = Map.copyOf(offsets);
  }

  @Override
  public Map<PassOutcomeKind, Double> compute(GameState state) {
    var dd = state.downAndDistance();
    if (dd.down() >= OBVIOUS_PASS_MIN_DOWN && dd.yardsToGo() >= OBVIOUS_PASS_MIN_YARDS_TO_GO) {
      return OBVIOUS_PASS_OFFSETS;
    }
    return Map.of();
  }
}
