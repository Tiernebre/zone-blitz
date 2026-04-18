package app.zoneblitz.gamesimulator.playcalling;

import app.zoneblitz.gamesimulator.band.BandRepository;
import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.playcalling.Situation.DistanceBucket;
import app.zoneblitz.gamesimulator.playcalling.Situation.FieldZone;
import app.zoneblitz.gamesimulator.playcalling.Situation.ScoreDiffBucket;
import app.zoneblitz.gamesimulator.playcalling.Situation.TimeBucket;
import java.util.EnumMap;
import java.util.Map;

/**
 * League-average priors used by {@link TendencyPlayCaller}. Pass-rate tables are loaded from {@code
 * play-call-tendencies.json} (nflfastR 2020-24 regular season); concept + formation mix tables are
 * hardcoded against FTN-tagged 2022-24 summaries in CLAUDE.md — once an FTN-sourced band file lands
 * we can swap the constants for a loader without touching callers.
 */
final class PlayCallBands {

  private static final String TENDENCIES = "play-call-tendencies.json";

  /**
   * FTN 2022-24: DROPBACK 52%, QUICK_GAME 18%, PLAY_ACTION 18%, SCREEN 10%, RPO 2%, HAIL_MARY <1%.
   */
  private static final Map<PassConcept, Double> PASS_CONCEPT_BASELINE =
      Map.of(
          PassConcept.DROPBACK, 0.52,
          PassConcept.QUICK_GAME, 0.18,
          PassConcept.PLAY_ACTION, 0.18,
          PassConcept.SCREEN, 0.09,
          PassConcept.RPO, 0.02,
          PassConcept.HAIL_MARY, 0.01);

  /** Rough run-concept mix: zone-heavy modern NFL with power/counter as the primary gap schemes. */
  private static final Map<RunConcept, Double> RUN_CONCEPT_BASELINE =
      Map.ofEntries(
          Map.entry(RunConcept.INSIDE_ZONE, 0.35),
          Map.entry(RunConcept.OUTSIDE_ZONE, 0.20),
          Map.entry(RunConcept.POWER, 0.12),
          Map.entry(RunConcept.COUNTER, 0.09),
          Map.entry(RunConcept.DRAW, 0.05),
          Map.entry(RunConcept.TRAP, 0.03),
          Map.entry(RunConcept.SWEEP, 0.05),
          Map.entry(RunConcept.QB_SNEAK, 0.03),
          Map.entry(RunConcept.QB_DRAW, 0.03),
          Map.entry(RunConcept.OTHER, 0.05));

  /** BDB-sourced formation mix on dropbacks — shotgun-heavy. */
  private static final Map<OffensiveFormation, Double> PASS_FORMATION_BASELINE =
      Map.of(
          OffensiveFormation.SHOTGUN, 0.78,
          OffensiveFormation.SINGLEBACK, 0.10,
          OffensiveFormation.PISTOL, 0.04,
          OffensiveFormation.EMPTY, 0.07,
          OffensiveFormation.I_FORM, 0.00,
          OffensiveFormation.JUMBO, 0.01);

  /** BDB-sourced formation mix on runs — under-center is still the plurality outside of SHOTGUN. */
  private static final Map<OffensiveFormation, Double> RUN_FORMATION_BASELINE =
      Map.of(
          OffensiveFormation.SHOTGUN, 0.42,
          OffensiveFormation.SINGLEBACK, 0.30,
          OffensiveFormation.PISTOL, 0.08,
          OffensiveFormation.I_FORM, 0.10,
          OffensiveFormation.EMPTY, 0.00,
          OffensiveFormation.JUMBO, 0.10);

  private final double leagueAveragePassRate;
  private final Map<String, Map<DistanceBucket, Double>> passRateByDownDistance;
  private final Map<ScoreDiffBucket, Map<TimeBucket, Double>> passRateByScoreTime;
  private final Map<FieldZone, Double> passRateByFieldZone;

  private PlayCallBands(
      double leagueAveragePassRate,
      Map<String, Map<DistanceBucket, Double>> passRateByDownDistance,
      Map<ScoreDiffBucket, Map<TimeBucket, Double>> passRateByScoreTime,
      Map<FieldZone, Double> passRateByFieldZone) {
    this.leagueAveragePassRate = leagueAveragePassRate;
    this.passRateByDownDistance = passRateByDownDistance;
    this.passRateByScoreTime = passRateByScoreTime;
    this.passRateByFieldZone = passRateByFieldZone;
  }

  static PlayCallBands load(BandRepository repo) {
    var overall = repo.loadScalar(TENDENCIES, "bands.pass_rate_overall.rate");

    var downDistance = new java.util.LinkedHashMap<String, Map<DistanceBucket, Double>>();
    for (var key : new String[] {"1st", "2nd", "3rd", "4th"}) {
      var rates =
          repo.loadRate(
              TENDENCIES, "bands.pass_rate_by_down_and_distance." + key, DistanceBucket.class);
      downDistance.put(key, Map.copyOf(rates.baseProbabilities()));
    }

    var scoreTime = new EnumMap<ScoreDiffBucket, Map<TimeBucket, Double>>(ScoreDiffBucket.class);
    for (var bucket : ScoreDiffBucket.values()) {
      var rates =
          repo.loadRate(
              TENDENCIES,
              "bands.pass_rate_by_score_diff_and_time." + bucket.name().toLowerCase(),
              TimeBucket.class);
      scoreTime.put(bucket, Map.copyOf(rates.baseProbabilities()));
    }

    var fieldZoneRates =
        repo.loadRate(TENDENCIES, "bands.pass_rate_by_field_zone", FieldZone.class);

    return new PlayCallBands(
        overall,
        Map.copyOf(downDistance),
        Map.copyOf(scoreTime),
        Map.copyOf(fieldZoneRates.baseProbabilities()));
  }

  double leagueAveragePassRate() {
    return leagueAveragePassRate;
  }

  /** Baseline pass rate keyed by (down, distance). Falls back to the overall league average. */
  double passRateForDownDistance(Situation s) {
    var dist = passRateByDownDistance.getOrDefault(s.downKey(), Map.of());
    return dist.getOrDefault(s.distanceBucket(), leagueAveragePassRate);
  }

  double passRateForScoreTime(Situation s) {
    var times = passRateByScoreTime.getOrDefault(s.scoreDiffBucket(), Map.of());
    return times.getOrDefault(s.timeBucket(), leagueAveragePassRate);
  }

  double passRateForFieldZone(Situation s) {
    return passRateByFieldZone.getOrDefault(s.fieldZone(), leagueAveragePassRate);
  }

  Map<PassConcept, Double> passConceptBaseline() {
    return PASS_CONCEPT_BASELINE;
  }

  Map<RunConcept, Double> runConceptBaseline() {
    return RUN_CONCEPT_BASELINE;
  }

  Map<OffensiveFormation, Double> passFormationBaseline() {
    return PASS_FORMATION_BASELINE;
  }

  Map<OffensiveFormation, Double> runFormationBaseline() {
    return RUN_FORMATION_BASELINE;
  }
}
