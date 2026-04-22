package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import java.util.Objects;

/**
 * Baseline 4th-down policy driven by field position, distance, coach aggression, and score/time
 * context. Designed to land on a league-average ~15-20% go-for-it rate when coach aggression is 50
 * (neutral), skewing higher as aggression rises, and swinging further toward GO late in the game
 * when the offense trails.
 *
 * <p>Field-position buckets:
 *
 * <ul>
 *   <li>Opp red zone (yardLine &gt;= 80) and short (dist &lt;= 3): strong GO lean; fall back to FG
 *       otherwise.
 *   <li>FG range (yardLine &gt;= 63): kick unless it's 4th-and-inches deep in FG range, where
 *       aggression can still trigger a GO.
 *   <li>No-man's land (yardLine 50..62): GO for short, otherwise PUNT — aggression shifts the
 *       distance threshold.
 *   <li>Own territory (yardLine &lt; 50): PUNT unless truly desperate (late 4th, trailing badly,
 *       and 4th-and-short).
 * </ul>
 */
public final class AggressionFourthDownPolicy implements FourthDownPolicy {

  private static final int FIELD_GOAL_MIN_YARD_LINE = 63;
  private static final int RED_ZONE_YARD_LINE = 80;
  private static final int MIDFIELD = 50;

  @Override
  public Decision decide(GameState state, Coach offenseCoach, RandomSource rng) {
    Objects.requireNonNull(state, "state");
    Objects.requireNonNull(offenseCoach, "offenseCoach");
    Objects.requireNonNull(rng, "rng");

    if (state.downAndDistance().down() != 4) {
      throw new IllegalStateException("FourthDownPolicy consulted on non-4th down");
    }

    var yardLine = state.spot().yardLine();
    var distance = state.downAndDistance().yardsToGo();
    var aggression = offenseCoach.offense().aggression();
    var desperation = desperationBoost(state, offenseCoach);
    var goProb = baselineGoProbability(yardLine, distance);
    goProb += (aggression - 50) / 100.0 * 0.3;
    goProb += desperation;
    goProb = Math.max(0.0, Math.min(1.0, goProb));

    if (rng.nextDouble() < goProb) {
      return Decision.GO_FOR_IT;
    }
    if (yardLine >= FIELD_GOAL_MIN_YARD_LINE) {
      return Decision.ATTEMPT_FIELD_GOAL;
    }
    return Decision.PUNT;
  }

  private static double baselineGoProbability(int yardLine, int distance) {
    if (yardLine >= RED_ZONE_YARD_LINE && distance <= 3) {
      return 0.35;
    }
    if (yardLine >= FIELD_GOAL_MIN_YARD_LINE) {
      return distance <= 1 ? 0.2 : 0.03;
    }
    if (yardLine >= MIDFIELD) {
      return switch (distance) {
        case 1 -> 0.55;
        case 2 -> 0.35;
        case 3 -> 0.2;
        default -> 0.08;
      };
    }
    // Own territory.
    return distance <= 1 ? 0.12 : 0.02;
  }

  private static double desperationBoost(GameState state, Coach offenseCoach) {
    var clock = state.clock();
    var score = state.score();
    var offenseSide = state.possession();
    var offenseScore =
        offenseSide == app.zoneblitz.gamesimulator.event.Side.HOME ? score.home() : score.away();
    var defenseScore =
        offenseSide == app.zoneblitz.gamesimulator.event.Side.HOME ? score.away() : score.home();
    var margin = offenseScore - defenseScore;
    if (clock.quarter() < 4) {
      return 0.0;
    }
    if (margin >= 0) {
      return 0.0;
    }
    // Trailing in the fourth: scale boost by deficit and remaining time.
    var deficitFactor = Math.min(1.0, (-margin) / 14.0);
    var timeFactor = Math.max(0.0, 1.0 - clock.secondsRemaining() / 600.0);
    var clockAwareness = offenseCoach.offense().clockAwareness() / 100.0;
    return 0.35 * deficitFactor * timeFactor * clockAwareness;
  }
}
