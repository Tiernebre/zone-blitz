package app.zoneblitz.gamesimulator.resolver.run;

import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.resolver.run.MatchupRunResolver.RunMatchupShift;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.Objects;

/**
 * Field-position contribution to the run matchup shift. Compresses probability mass away from
 * {@code BREAKAWAY} and toward {@code STUFF}/{@code NORMAL} as the offense approaches the opponent
 * goal line.
 *
 * <p>Calibration reference (nflfastR 2020–2024, regular season, rushes from {@code yardline_100}):
 *
 * <ul>
 *   <li>1-yard line: TD% ≈ 58%, stuff% (≤0 yds) ≈ 42%, breakaway% (≥10 yds) ≈ 0%
 *   <li>2-yard line: TD% ≈ 46%, breakaway% ≈ 0%
 *   <li>3-yard line: TD% ≈ 37%, breakaway% ≈ 0%
 *   <li>5-yard line: TD% ≈ 24%, breakaway% ≈ 0%
 *   <li>10-yard line: breakaway% ≈ 11% (back at mid-field baseline)
 * </ul>
 *
 * <p>The shipped run bands are league-average across all field positions, so at the 1 they still
 * carry ~2% {@code BREAKAWAY} mass and no {@code STUFF} elevation. This shift applies a negative
 * scalar inside the red zone — negative {@link RunMatchupShift} composes with the existing
 * per-outcome β coefficients ({@code STUFF = -0.4}, {@code BREAKAWAY = +0.5}) to push probability
 * mass from breakaway toward stuff/normal. End-zone clamping in the scoring path then converts most
 * {@code NORMAL} gains from the 1 into rush TDs, matching the observed TD rate.
 *
 * <p>On short-yardage snaps ({@code yardsToGo ≤ 1}) concepts biased toward downhill push ({@code
 * POWER}, {@code QB_SNEAK}) get a small positive offset so their conversion rate isn't
 * over-penalised by the red-zone ramp. Situational play selection (who calls the sneak) is out of
 * scope — issue #571 tracks this explicitly.
 */
public final class GoalLineRunShift implements RunMatchupShift {

  /**
   * Per-yard magnitude of the red-zone ramp. Kicks in at {@code yardsToGoal ≤ 10} and peaks at
   * {@code yardsToGoal == 1}: {@code shift = -0.2 × (11 − yardsToGoal)} → {@code -2.0} at the 1,
   * {@code -1.2} at the 5, {@code -0.2} at the 10. Zero outside the red zone.
   */
  public static final double DEFAULT_SHIFT_PER_YARD = 0.2;

  /** Where the ramp turns on (yards from the opponent goal line, inclusive). */
  public static final int DEFAULT_RED_ZONE_THRESHOLD = 10;

  /**
   * Offset applied when short-yardage ({@code yardsToGo ≤ 1}) meets {@code POWER}/{@code QB_SNEAK}.
   * Partially counters the red-zone negative so short-yardage sneaks still convert at realistic
   * rates inside the 5.
   */
  public static final double DEFAULT_SHORT_YARDAGE_POWER_BONUS = 0.4;

  private final double shiftPerYard;
  private final int redZoneThreshold;
  private final double shortYardagePowerBonus;

  public GoalLineRunShift() {
    this(DEFAULT_SHIFT_PER_YARD, DEFAULT_RED_ZONE_THRESHOLD, DEFAULT_SHORT_YARDAGE_POWER_BONUS);
  }

  public GoalLineRunShift(
      double shiftPerYard, int redZoneThreshold, double shortYardagePowerBonus) {
    this.shiftPerYard = shiftPerYard;
    this.redZoneThreshold = redZoneThreshold;
    this.shortYardagePowerBonus = shortYardagePowerBonus;
  }

  @Override
  public double compute(RunMatchupContext context, RandomSource rng) {
    Objects.requireNonNull(context, "context");
    Objects.requireNonNull(rng, "rng");
    var yardsToGoal = context.yardsToGoal();
    if (yardsToGoal > redZoneThreshold) {
      return 0.0;
    }
    var redZone = -shiftPerYard * (redZoneThreshold + 1 - yardsToGoal);
    var concept = context.concept();
    if (context.yardsToGo() <= 1
        && (concept == RunConcept.POWER || concept == RunConcept.QB_SNEAK)) {
      return redZone + shortYardagePowerBonus;
    }
    return redZone;
  }
}
