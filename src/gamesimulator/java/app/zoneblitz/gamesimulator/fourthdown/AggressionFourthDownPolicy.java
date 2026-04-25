package app.zoneblitz.gamesimulator.fourthdown;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import java.util.Objects;

/**
 * 4th-down policy that blends a tendency-driven go rate (field position, distance, coach
 * aggression) with an EV-optimal reference from a {@link FourthDownEvTable}, weighted by the
 * coach's {@link app.zoneblitz.gamesimulator.roster.CoachQuality#decisionQuality()}. A {@code
 * decisionQuality = 0} coach calls it purely on style; a {@code decisionQuality = 100} coach
 * follows the chart. Desperation (late 4th, trailing badly) adds on top of the blend.
 *
 * <p>Tendency field-position buckets:
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

  private final FourthDownEvTable evTable;

  public AggressionFourthDownPolicy() {
    this(new StaticFourthDownEvTable());
  }

  AggressionFourthDownPolicy(FourthDownEvTable evTable) {
    this.evTable = Objects.requireNonNull(evTable, "evTable");
  }

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
    var decisionQuality = offenseCoach.quality().decisionQuality();
    var desperation = desperationBoost(state, offenseCoach);

    var tendencyProb = baselineGoProbability(yardLine, distance) + (aggression - 50) / 100.0 * 0.3;
    var evProb = evTable.evOptimalGoProbability(yardLine, distance);
    var qWeight = decisionQuality / 100.0;
    var blended = (1.0 - qWeight) * tendencyProb + qWeight * evProb;

    var goProb = Math.max(0.0, Math.min(1.0, blended + desperation));

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
