package app.zoneblitz.gamesimulator.kickoff;

import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Skill;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * Attribute-aware {@link OnsideRecoveryRate} decorator. Shifts the delegate baseline (typically
 * 10%) based on three personnel axes:
 *
 * <ul>
 *   <li><b>Kicker placement</b> — the best K's {@link Skill#kickAccuracy()}. A precise short-kick
 *       placement gives cover players a recoverable ball; a poor one bounces unpredictably out of
 *       reach.
 *   <li><b>Kicking team hands strength</b> — mean blend of {@link Skill#ballSkills()} (60%) and
 *       {@link Skill#hands()} (40%) across the kicking team's non-K, non-P roster (the cover squad
 *       converging on the ball).
 *   <li><b>Receiving team hands strength</b> — same blend over the receiving team's non-K, non-P
 *       roster (the hands team that actually catches the kick).
 * </ul>
 *
 * <p>Each axis is centered to {@code [-1, +1]} (50 → 0, 0 → -1, 100 → +1). The raw shift is {@code
 * (kicker + coverHands − receivingHands) / 3}, scaled by {@link #MAX_SHIFT} ({@value #MAX_SHIFT})
 * and clamped — so even a 100/100 vs 0/0 mismatch only moves the rate by 5 percentage points.
 * Onside kicks remain ball-bounce-dominated; this decorator surfaces a real personnel edge without
 * overriding the baseline randomness.
 */
public final class AttributeAwareOnsideRecoveryRate implements OnsideRecoveryRate {

  /** Maximum absolute shift applied to the delegate rate. Keeps onside ball-bounce-dominated. */
  static final double MAX_SHIFT = 0.05;

  private static final double BALL_SKILLS_WEIGHT = 0.60;
  private static final double HANDS_WEIGHT = 0.40;

  private final OnsideRecoveryRate delegate;

  public AttributeAwareOnsideRecoveryRate(OnsideRecoveryRate delegate) {
    this.delegate = Objects.requireNonNull(delegate, "delegate");
  }

  @Override
  public double compute(Team kicking, Team receiving) {
    Objects.requireNonNull(kicking, "kicking");
    Objects.requireNonNull(receiving, "receiving");

    var baseline = delegate.compute(kicking, receiving);
    var kickerScore = bestKickerAccuracyScore(kicking);
    var coverScore = handsTeamScore(kicking);
    var handsScore = handsTeamScore(receiving);

    var raw = (kickerScore + coverScore - handsScore) / 3.0;
    var shift = clamp(raw, 1.0) * MAX_SHIFT;
    return clamp01(baseline + shift);
  }

  private static double bestKickerAccuracyScore(Team team) {
    var best =
        team.roster().stream()
            .filter(p -> p.position() == Position.K)
            .max(Comparator.comparingInt(p -> p.skill().kickAccuracy()));
    if (best.isEmpty()) {
      return 0.0;
    }
    return centered(best.get().skill().kickAccuracy());
  }

  private static double handsTeamScore(Team team) {
    var pool =
        team.roster().stream()
            .filter(p -> p.position() != Position.K && p.position() != Position.P)
            .toList();
    if (pool.isEmpty()) {
      return 0.0;
    }
    return centered(meanHands(pool));
  }

  private static double meanHands(List<Player> pool) {
    var sum = 0.0;
    for (var p : pool) {
      sum += BALL_SKILLS_WEIGHT * p.skill().ballSkills() + HANDS_WEIGHT * p.skill().hands();
    }
    return sum / pool.size();
  }

  private static double centered(double zeroToHundred) {
    return (zeroToHundred / 100.0 - 0.5) * 2.0;
  }

  private static double clamp(double value, double limit) {
    if (value > limit) {
      return limit;
    }
    if (value < -limit) {
      return -limit;
    }
    return value;
  }

  private static double clamp01(double value) {
    if (value < 0.0) {
      return 0.0;
    }
    if (value > 1.0) {
      return 1.0;
    }
    return value;
  }
}
