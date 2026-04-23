package app.zoneblitz.gamesimulator.penalty;

import app.zoneblitz.gamesimulator.event.PenaltyType;
import app.zoneblitz.gamesimulator.event.Side;
import java.util.List;
import java.util.Map;

/**
 * Static calibration table for all {@link PenaltyType} values. Numbers are mean per-scrimmage-play
 * rates and observed accepted-yardage means derived from 2020–2024 nflfastR regular-season
 * play-by-play (see {@code docs/calibration/penalties.md} if/when we promote this to a band file).
 *
 * <p>Kept package-private on purpose: consumers go through {@link PenaltyModel}. Values are
 * hardcoded rather than loaded from JSON because they are flat scalars, not distributional ladders
 * — no sampler plumbing to gain by routing them through the band repo.
 */
final class PenaltyCatalog {

  enum Bucket {
    PRE_SNAP,
    DURING,
    POST_PLAY
  }

  /**
   * One row per {@link PenaltyType}.
   *
   * @param rate expected fires per scrimmage play (accepted flags only; a floor, since pbp counts
   *     one flag per play)
   * @param yards observed mean accepted yardage (not the rulebook nominal — half-distance and
   *     spot-foul enforcement skew the empirical mean)
   * @param offenseProb probability the foul is called against the offense (remainder is defense)
   * @param obviousPassMultiplier multiplicative scalar applied to the base rate on obvious-pass
   *     downs (3rd/4th and 7+). {@code 1.0} = no situational dependence. Pass-pro and coverage
   *     fouls (holding, PI, illegal contact, RTP) spike in these situations in real pbp; pre-snap
   *     fouls rise more modestly due to noise and snap-count tension.
   */
  record Spec(
      PenaltyType type,
      Bucket bucket,
      double rate,
      int yards,
      double offenseProb,
      double obviousPassMultiplier) {
    Spec(PenaltyType type, Bucket bucket, double rate, int yards, double offenseProb) {
      this(type, bucket, rate, yards, offenseProb, 1.0);
    }
  }

  private static final List<Spec> SPECS =
      List.of(
          // Pass-pro and coverage fouls — dominant signal on obvious-pass downs.
          new Spec(PenaltyType.HOLDING_OFFENSE, Bucket.DURING, 0.01607, 10, 0.89, 1.7),
          new Spec(PenaltyType.PASS_INTERFERENCE_DEFENSE, Bucket.DURING, 0.00767, 16, 0.0, 1.5),
          new Spec(PenaltyType.HOLDING_DEFENSE, Bucket.DURING, 0.00482, 5, 0.0, 1.4),
          new Spec(PenaltyType.ILLEGAL_CONTACT, Bucket.DURING, 0.00161, 5, 0.0, 1.6),
          new Spec(PenaltyType.ILLEGAL_USE_OF_HANDS, Bucket.DURING, 0.00165, 6, 0.25, 1.3),
          new Spec(PenaltyType.PASS_INTERFERENCE_OFFENSE, Bucket.DURING, 0.00186, 10, 1.0, 1.4),
          new Spec(PenaltyType.ROUGHING_THE_PASSER, Bucket.DURING, 0.00301, 13, 0.0, 1.4),
          // Pre-snap — noise and snap-count tension lift false start and formation issues.
          new Spec(PenaltyType.FALSE_START, Bucket.PRE_SNAP, 0.01601, 5, 1.0, 1.3),
          new Spec(PenaltyType.ILLEGAL_FORMATION, Bucket.PRE_SNAP, 0.00188, 5, 0.82, 1.2),
          new Spec(PenaltyType.DELAY_OF_GAME, Bucket.PRE_SNAP, 0.00416, 5, 1.0, 1.1),
          new Spec(PenaltyType.OFFSIDE, Bucket.PRE_SNAP, 0.00421, 5, 0.05, 1.2),
          new Spec(PenaltyType.NEUTRAL_ZONE_INFRACTION, Bucket.PRE_SNAP, 0.00290, 5, 0.0, 1.2),
          new Spec(PenaltyType.ENCROACHMENT, Bucket.PRE_SNAP, 0.00093, 5, 0.0, 1.2),
          // Situation-neutral or play-type-driven — hold at 1.0.
          new Spec(PenaltyType.UNNECESSARY_ROUGHNESS, Bucket.DURING, 0.00442, 13, 0.21),
          new Spec(PenaltyType.FACE_MASK, Bucket.DURING, 0.00207, 14, 0.23),
          new Spec(PenaltyType.ILLEGAL_BLOCK_IN_THE_BACK, Bucket.DURING, 0.00170, 9, 0.57),
          new Spec(PenaltyType.TWELVE_MEN_ON_FIELD, Bucket.PRE_SNAP, 0.00133, 5, 0.22),
          new Spec(PenaltyType.ILLEGAL_SHIFT, Bucket.PRE_SNAP, 0.00094, 5, 1.0),
          new Spec(PenaltyType.UNSPORTSMANLIKE_CONDUCT, Bucket.POST_PLAY, 0.00079, 15, 0.56),
          new Spec(PenaltyType.TAUNTING, Bucket.POST_PLAY, 0.00057, 15, 0.54),
          new Spec(PenaltyType.HORSE_COLLAR, Bucket.DURING, 0.00041, 15, 0.08),
          new Spec(PenaltyType.ILLEGAL_MOTION, Bucket.PRE_SNAP, 0.00023, 5, 0.93),
          // Roughing the kicker is a special-teams-only flag; catalog keeps it at the measured
          // rate for documentation but the scrimmage-facing draws in BandPenaltyModel skip it.
          new Spec(PenaltyType.ROUGHING_THE_KICKER, Bucket.DURING, 0.00016, 15, 0.0),
          new Spec(PenaltyType.CLIPPING, Bucket.DURING, 0.00005, 14, 1.0),
          new Spec(PenaltyType.OTHER, Bucket.DURING, 0.00600, 10, 0.5));

  private static final Map<PenaltyType, Spec> BY_TYPE =
      SPECS.stream().collect(java.util.stream.Collectors.toMap(Spec::type, s -> s));

  private PenaltyCatalog() {}

  static List<Spec> inBucket(Bucket bucket) {
    return SPECS.stream().filter(s -> s.bucket() == bucket).toList();
  }

  static Spec of(PenaltyType type) {
    var spec = BY_TYPE.get(type);
    if (spec == null) {
      throw new IllegalArgumentException("No catalog entry for " + type);
    }
    return spec;
  }

  /**
   * Enforcement rules for a flag of the given type called against the given side. Derived from the
   * type + against-side; the offense side is needed to tell which direction enforcement runs.
   */
  static PenaltyEnforcement enforcementFor(PenaltyType type, Side against, Side offenseSide) {
    var offendingOffense = against == offenseSide;
    return switch (type) {
      case FALSE_START,
          OFFSIDE,
          ENCROACHMENT,
          NEUTRAL_ZONE_INFRACTION,
          DELAY_OF_GAME,
          ILLEGAL_FORMATION,
          ILLEGAL_SHIFT,
          ILLEGAL_MOTION,
          TWELVE_MEN_ON_FIELD ->
          PenaltyEnforcement.preSnap();
      case UNSPORTSMANLIKE_CONDUCT, TAUNTING -> PenaltyEnforcement.postPlayDeadBall();
      case PASS_INTERFERENCE_DEFENSE -> PenaltyEnforcement.defensiveSpotFoul();
      case PASS_INTERFERENCE_OFFENSE -> PenaltyEnforcement.offenseLossOfDown();
      case HOLDING_OFFENSE -> PenaltyEnforcement.offenseReplay();
      case HOLDING_DEFENSE, ILLEGAL_CONTACT ->
          offendingOffense
              ? PenaltyEnforcement.offenseReplay()
              : PenaltyEnforcement.defenseAutoFirstDown();
      case ILLEGAL_USE_OF_HANDS ->
          offendingOffense
              ? PenaltyEnforcement.offenseReplay()
              : PenaltyEnforcement.defenseAutoFirstDown();
      case ROUGHING_THE_PASSER,
          ROUGHING_THE_KICKER,
          FACE_MASK,
          UNNECESSARY_ROUGHNESS,
          HORSE_COLLAR ->
          offendingOffense
              ? PenaltyEnforcement.personalFoulOnOffense()
              : PenaltyEnforcement.personalFoulOnDefense();
      case ILLEGAL_BLOCK_IN_THE_BACK, CLIPPING ->
          offendingOffense
              ? PenaltyEnforcement.offenseReplay()
              : PenaltyEnforcement.personalFoulOnDefense();
      case OTHER ->
          offendingOffense
              ? PenaltyEnforcement.offenseReplay()
              : PenaltyEnforcement.defenseAutoFirstDown();
    };
  }
}
