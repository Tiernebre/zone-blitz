package app.zoneblitz.gamesimulator;

/**
 * Hand-encoded EV-optimal 4th-down go probabilities based on Ben Baldwin's 4th-down decision bot.
 * Each cell captures the <em>strength</em> of the bot's recommendation in a single number: near-1.0
 * when going is clearly EV-positive, near-0.0 when kicking/punting clearly wins, middling values
 * near the break-even line. Resolution is field-zone × distance-bucket — coarse enough to maintain
 * by hand, fine enough to make a {@code decisionQuality = 100} coach visibly more aggressive than
 * the league-average baseline in {@link AggressionFourthDownPolicy}.
 *
 * <p>Replace with an {@code nfl4th}-derived table if a dedicated calibration pass becomes worth the
 * integration cost — the {@link FourthDownEvTable} seam is the swap point.
 */
final class StaticFourthDownEvTable implements FourthDownEvTable {

  private static final double[][] GO_PROBABILITY = {
    // inches(1)  short(2-3)  medium(4-6)  long(7-10)  very-long(11+)
    {0.15, 0.05, 0.02, 0.01, 0.00}, // deep own (< own 30)
    {0.50, 0.20, 0.08, 0.03, 0.01}, // own territory (own 30–49)
    {0.90, 0.70, 0.40, 0.15, 0.05}, // midfield (50–59)
    {0.90, 0.70, 0.35, 0.12, 0.04}, // plus territory (60–69)
    {0.70, 0.40, 0.15, 0.05, 0.02}, // FG fringe (70–79)
    {0.80, 0.55, 0.25, 0.08, 0.03}, // red zone (80–94)
    {0.95, 0.80, 0.45, 0.15, 0.05}, // goal line (95+)
  };

  @Override
  public double evOptimalGoProbability(int yardLine, int distance) {
    if (distance < 1) {
      return 0.0;
    }
    return GO_PROBABILITY[fieldZoneIndex(yardLine)][distanceIndex(distance)];
  }

  private static int fieldZoneIndex(int yardLine) {
    if (yardLine < 30) {
      return 0;
    }
    if (yardLine < 50) {
      return 1;
    }
    if (yardLine < 60) {
      return 2;
    }
    if (yardLine < 70) {
      return 3;
    }
    if (yardLine < 80) {
      return 4;
    }
    if (yardLine < 95) {
      return 5;
    }
    return 6;
  }

  private static int distanceIndex(int distance) {
    if (distance == 1) {
      return 0;
    }
    if (distance <= 3) {
      return 1;
    }
    if (distance <= 6) {
      return 2;
    }
    if (distance <= 10) {
      return 3;
    }
    return 4;
  }
}
