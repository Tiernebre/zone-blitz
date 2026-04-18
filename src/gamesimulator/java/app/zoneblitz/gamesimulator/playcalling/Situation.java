package app.zoneblitz.gamesimulator.playcalling;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.event.Side;

/**
 * Bucketed situational context used as the key into the league-average play-call bands. Buckets
 * mirror the {@code play-call-tendencies.json} schema so enum {@code name().toLowerCase()} maps
 * directly onto the JSON keys (e.g. {@link DistanceBucket#LONG_7_10} → {@code "long_7_10"}).
 *
 * <p>{@link #from(GameState)} is the only way to construct — keeps the bucketing logic in one place
 * so situational priors and tendency shifts agree on how a given snap is classified.
 */
public record Situation(
    int down,
    DistanceBucket distanceBucket,
    ScoreDiffBucket scoreDiffBucket,
    TimeBucket timeBucket,
    FieldZone fieldZone) {

  /** Distance-to-go bucket; {@code name().toLowerCase()} matches the band JSON keys. */
  public enum DistanceBucket {
    SHORT_1_2,
    MEDIUM_3_6,
    LONG_7_10,
    VERY_LONG_11_PLUS
  }

  /** Offense-point-differential bucket; positive → offense leading. */
  public enum ScoreDiffBucket {
    TRAILING_15_PLUS,
    TRAILING_8_TO_14,
    TRAILING_1_TO_7,
    TIED,
    LEADING_1_TO_7,
    LEADING_8_TO_14,
    LEADING_15_PLUS
  }

  /** Game-clock bucket matching the situational band table. */
  public enum TimeBucket {
    Q1,
    Q2,
    Q3,
    Q4_EARLY,
    TWO_MIN_H1,
    UNDER_5_MIN_Q4
  }

  /** Field-zone bucket; mirrors {@code yardline_100} buckets in the band file. */
  public enum FieldZone {
    OWN_DEEP,
    OWN_SIDE,
    MIDFIELD,
    OPP_SIDE,
    RED_ZONE_OUTER,
    RED_ZONE_INNER,
    GOAL_TO_GO
  }

  private static final int TWO_MIN = 2 * 60;
  private static final int FIVE_MIN = 5 * 60;

  /** Derive the situation from a live game state. */
  public static Situation from(GameState state) {
    var dd = state.downAndDistance();
    return new Situation(
        Math.max(1, Math.min(4, dd.down())),
        distanceBucket(dd.yardsToGo()),
        scoreDiffBucket(state),
        timeBucket(state),
        fieldZone(state.spot().yardLine()));
  }

  /** Key form used to look up down-conditional bands: {@code "1st"}, {@code "2nd"}, etc. */
  public String downKey() {
    return switch (down) {
      case 1 -> "1st";
      case 2 -> "2nd";
      case 3 -> "3rd";
      default -> "4th";
    };
  }

  private static DistanceBucket distanceBucket(int yardsToGo) {
    if (yardsToGo <= 2) {
      return DistanceBucket.SHORT_1_2;
    }
    if (yardsToGo <= 6) {
      return DistanceBucket.MEDIUM_3_6;
    }
    if (yardsToGo <= 10) {
      return DistanceBucket.LONG_7_10;
    }
    return DistanceBucket.VERY_LONG_11_PLUS;
  }

  private static ScoreDiffBucket scoreDiffBucket(GameState state) {
    var score = state.score();
    var diff =
        state.possession() == Side.HOME ? score.home() - score.away() : score.away() - score.home();
    if (diff <= -15) return ScoreDiffBucket.TRAILING_15_PLUS;
    if (diff <= -8) return ScoreDiffBucket.TRAILING_8_TO_14;
    if (diff <= -1) return ScoreDiffBucket.TRAILING_1_TO_7;
    if (diff == 0) return ScoreDiffBucket.TIED;
    if (diff <= 7) return ScoreDiffBucket.LEADING_1_TO_7;
    if (diff <= 14) return ScoreDiffBucket.LEADING_8_TO_14;
    return ScoreDiffBucket.LEADING_15_PLUS;
  }

  private static TimeBucket timeBucket(GameState state) {
    var clock = state.clock();
    var quarter = clock.quarter();
    var remaining = clock.secondsRemaining();
    return switch (quarter) {
      case 1 -> TimeBucket.Q1;
      case 2 -> remaining <= TWO_MIN ? TimeBucket.TWO_MIN_H1 : TimeBucket.Q2;
      case 3 -> TimeBucket.Q3;
      case 4 -> remaining <= FIVE_MIN ? TimeBucket.UNDER_5_MIN_Q4 : TimeBucket.Q4_EARLY;
      default -> TimeBucket.UNDER_5_MIN_Q4;
    };
  }

  private static FieldZone fieldZone(int yardLine) {
    if (yardLine >= 96) return FieldZone.GOAL_TO_GO;
    if (yardLine >= 90) return FieldZone.RED_ZONE_INNER;
    if (yardLine >= 80) return FieldZone.RED_ZONE_OUTER;
    if (yardLine >= 60) return FieldZone.OPP_SIDE;
    if (yardLine >= 40) return FieldZone.MIDFIELD;
    if (yardLine >= 20) return FieldZone.OWN_SIDE;
    return FieldZone.OWN_DEEP;
  }
}
