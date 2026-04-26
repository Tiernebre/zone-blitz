package app.zoneblitz.gamesimulator.penalty;

import static app.zoneblitz.gamesimulator.roster.PlayerBuilder.aPlayer;
import static app.zoneblitz.gamesimulator.roster.TendenciesBuilder.aTendencies;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.TestGameStates;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.TestPersonnel;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import app.zoneblitz.gamesimulator.roster.CoachId;
import app.zoneblitz.gamesimulator.roster.CoachQuality;
import app.zoneblitz.gamesimulator.roster.CoachTendencies;
import app.zoneblitz.gamesimulator.roster.DefensiveCoachTendencies;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Aggregate-rate sanity checks for {@link BandPenaltyModel}. We run a large number of draws against
 * a fixed RNG seed and verify the empirical rates match the catalog within a tolerance. This
 * defends against regressions in the catalog table or the sampling math.
 */
class BandPenaltyModelTests {

  private static final int DRAWS = 100_000;

  private final BandPenaltyModel model = new BandPenaltyModel();
  private final GameState state = GameState.initial();
  private final OffensivePersonnel offense = TestPersonnel.baselineOffense();
  private final DefensivePersonnel defense = TestPersonnel.baselineDefense();
  private final Coach neutralOffCoach = coachWithPreparation(50, 0xA);
  private final Coach neutralDefCoach = coachWithPreparation(50, 0xB);

  @Test
  void preSnap_aggregateRate_matchesCatalogWithinTolerance() {
    var root = new SplittableRandomSource(0xC0FFEEL);
    var hits = 0;
    for (var i = 0; i < DRAWS; i++) {
      if (model
          .preSnap(state, offense, defense, neutralOffCoach, neutralDefCoach, root.split(i))
          .isPresent()) {
        hits++;
      }
    }
    // Catalog pre-snap total ≈ 0.0326/play. At 100k draws ±0.004 tolerance keeps CI stable.
    var rate = (double) hits / DRAWS;
    assertThat(rate).isBetween(0.027, 0.040);
  }

  @Test
  void duringPlay_aggregateRate_matchesCatalogWithinTolerance() {
    var root = new SplittableRandomSource(0xBAD5EEDL);
    var hits = 0;
    for (var i = 0; i < DRAWS; i++) {
      if (model.duringPlay(null, null, state, offense, defense, root.split(i)).isPresent()) {
        hits++;
      }
    }
    // Catalog during-play total ≈ 0.0512/play (excluding roughing-the-kicker).
    var rate = (double) hits / DRAWS;
    assertThat(rate).isBetween(0.043, 0.060);
  }

  @Test
  void duringPlay_obviousPassDown_raisesAggregateRateAboveBaseline() {
    var baseline = drainDuringPlay(0xB44E1L, GameState.initial());
    var thirdAndLong = drainDuringPlay(0xB44E1L, TestGameStates.neutral(3, 10, 25));

    // Pass-pro / coverage fouls carry the largest multipliers (holding, PI, illegal contact, RTP).
    // On 3rd-and-10 the DURING aggregate must land meaningfully above the 1st-and-10 baseline.
    assertThat(thirdAndLong).isGreaterThan(baseline + 0.004);
  }

  @Test
  void preSnap_obviousPassDown_raisesAggregateRateAboveBaseline() {
    var baseline = drainPreSnap(0x51D3L, GameState.initial());
    var thirdAndLong = drainPreSnap(0x51D3L, TestGameStates.neutral(3, 10, 25));

    assertThat(thirdAndLong).isGreaterThan(baseline + 0.002);
  }

  @Test
  void duringPlay_shortYardage_leavesAggregateRateAtBaseline() {
    var baseline = drainDuringPlay(0xB44E2L, GameState.initial());
    var thirdAndShort = drainDuringPlay(0xB44E2L, TestGameStates.neutral(3, 1, 25));

    // 3rd-and-1 is below the obvious-pass threshold; multipliers do not fire.
    assertThat(thirdAndShort).isCloseTo(baseline, within(0.003));
  }

  private double drainDuringPlay(long seed, GameState s) {
    var root = new SplittableRandomSource(seed);
    var hits = 0;
    for (var i = 0; i < DRAWS; i++) {
      if (model.duringPlay(null, null, s, offense, defense, root.split(i)).isPresent()) {
        hits++;
      }
    }
    return (double) hits / DRAWS;
  }

  private double drainPreSnap(long seed, GameState s) {
    return drainPreSnap(seed, s, neutralOffCoach, neutralDefCoach);
  }

  private double drainPreSnap(long seed, GameState s, Coach offCoach, Coach defCoach) {
    var root = new SplittableRandomSource(seed);
    var hits = 0;
    for (var i = 0; i < DRAWS; i++) {
      if (model.preSnap(s, offense, defense, offCoach, defCoach, root.split(i)).isPresent()) {
        hits++;
      }
    }
    return (double) hits / DRAWS;
  }

  @Test
  void preSnap_flawlessOffenseCoach_cutsAggregateRateBelowBaseline() {
    var baseline = drainPreSnap(0xC0FFEEL, state);
    var flawless = coachWithPreparation(100, 0xC);
    var withFlawlessOffense = drainPreSnap(0xC0FFEEL, state, flawless, neutralDefCoach);

    // MAX_PREP_SHIFT=0.8 on the offense slice of pre-snap rates pulls the aggregate meaningfully
    // below the neutral baseline.
    assertThat(withFlawlessOffense).isLessThan(baseline - 0.005);
  }

  @Test
  void preSnap_unpreparedOffenseCoach_raisesAggregateRateAboveBaseline() {
    var baseline = drainPreSnap(0xC0FFEEL, state);
    var unprepared = coachWithPreparation(0, 0xD);
    var withUnpreparedOffense = drainPreSnap(0xC0FFEEL, state, unprepared, neutralDefCoach);

    assertThat(withUnpreparedOffense).isGreaterThan(baseline + 0.005);
  }

  @Test
  void postPlay_aggregateRate_matchesCatalogWithinTolerance() {
    var root = new SplittableRandomSource(0xF00DL);
    var hits = 0;
    for (var i = 0; i < DRAWS; i++) {
      if (model.postPlay(Side.HOME, offense, defense, root.split(i)).isPresent()) {
        hits++;
      }
    }
    // Catalog post-play total ≈ 0.00136/play — rare, so wider relative tolerance.
    var rate = (double) hits / DRAWS;
    assertThat(rate).isBetween(0.0008, 0.0025);
  }

  @Test
  void duringPlay_lowDisciplinePlayer_isFlaggedDisproportionatelyMoreThanHighDiscipline() {
    var lowest = olWithDiscipline(0, "ol-low", 1L);
    var middle1 = olWithDiscipline(25, "ol-mid1", 2L);
    var middle2 = olWithDiscipline(50, "ol-mid2", 3L);
    var middle3 = olWithDiscipline(75, "ol-mid3", 4L);
    var highest = olWithDiscipline(100, "ol-high", 5L);
    var spreadOffense = TestPersonnel.offenseWith(lowest, middle1, middle2, middle3, highest);

    var counts = drainOffenseCommitterCounts(0xD15C0L, spreadOffense, 10_000);

    var lowestHits = counts.getOrDefault(lowest.id(), 0);
    var highestHits = counts.getOrDefault(highest.id(), 0);
    assertThat(lowestHits)
        .as("lowest-discipline player should be flagged more than highest-discipline")
        .isGreaterThan(highestHits);
    // Envelope: low/high weights are 2.0 vs 0.25 (floor) → ~8x ceiling, but spread across 5 players
    // makes the practical ratio land in [1.5, 8]. A loose lower bound keeps the test stable.
    assertThat((double) lowestHits / Math.max(1, highestHits)).isGreaterThan(1.5);
  }

  @Test
  void duringPlay_uniformDiscipline_distributesCommitterApproximatelyUniformly() {
    var p1 = olWithDiscipline(50, "ol-u1", 11L);
    var p2 = olWithDiscipline(50, "ol-u2", 12L);
    var p3 = olWithDiscipline(50, "ol-u3", 13L);
    var p4 = olWithDiscipline(50, "ol-u4", 14L);
    var p5 = olWithDiscipline(50, "ol-u5", 15L);
    var uniformOffense = TestPersonnel.offenseWith(p1, p2, p3, p4, p5);

    var counts = drainOffenseCommitterCounts(0xC0DEL, uniformOffense, 100_000);
    var c1 = counts.getOrDefault(p1.id(), 0);
    var c2 = counts.getOrDefault(p2.id(), 0);
    var c3 = counts.getOrDefault(p3.id(), 0);
    var c4 = counts.getOrDefault(p4.id(), 0);
    var c5 = counts.getOrDefault(p5.id(), 0);

    // With identical discipline every player carries weight 1.0 and the offending-unit draw is
    // uniform across all 11 offensive players. With 100k trials, each of the 5 named OL should land
    // within a loose ratio bound of every other to defend against pure sampling variance.
    var min = Math.min(Math.min(Math.min(c1, c2), Math.min(c3, c4)), c5);
    var max = Math.max(Math.max(Math.max(c1, c2), Math.max(c3, c4)), c5);
    assertThat(min).isGreaterThan(0);
    assertThat((double) max / min).isLessThan(1.3);
  }

  @Test
  void duringPlay_disciplineSpreadOnOffendingUnit_preservesAggregateRate() {
    var lowest = olWithDiscipline(0, "ol-low", 21L);
    var middle1 = olWithDiscipline(25, "ol-mid1", 22L);
    var middle2 = olWithDiscipline(50, "ol-mid2", 23L);
    var middle3 = olWithDiscipline(75, "ol-mid3", 24L);
    var highest = olWithDiscipline(100, "ol-high", 25L);
    var spreadOffense = TestPersonnel.offenseWith(lowest, middle1, middle2, middle3, highest);

    var spreadRate = drainDuringPlay(0xB44E1L, GameState.initial(), spreadOffense, defense);
    var baselineRate = drainDuringPlay(0xB44E1L, GameState.initial(), offense, defense);

    // The spread OL averages discipline 50, identical to baseline; aggregate rate shouldn't drift.
    assertThat(spreadRate).isCloseTo(baselineRate, within(0.005));
  }

  private double drainDuringPlay(
      long seed, GameState s, OffensivePersonnel off, DefensivePersonnel def) {
    var root = new SplittableRandomSource(seed);
    var hits = 0;
    for (var i = 0; i < DRAWS; i++) {
      if (model.duringPlay(null, null, s, off, def, root.split(i)).isPresent()) {
        hits++;
      }
    }
    return (double) hits / DRAWS;
  }

  private Map<PlayerId, Integer> drainOffenseCommitterCounts(
      long seed, OffensivePersonnel off, int trials) {
    var root = new SplittableRandomSource(seed);
    var counts = new HashMap<PlayerId, Integer>();
    for (var i = 0; i < trials; i++) {
      var draw = model.duringPlay(null, null, state, off, defense, root.split(i));
      if (draw.isPresent() && draw.get().against() == state.possession()) {
        counts.merge(draw.get().committedBy(), 1, Integer::sum);
      }
    }
    return counts;
  }

  private static Player olWithDiscipline(int discipline, String name, long idLow) {
    return aPlayer()
        .withId(0L, idLow)
        .atPosition(Position.OL)
        .withDisplayName(name)
        .withTendencies(aTendencies().withDiscipline(discipline))
        .build();
  }

  private static Coach coachWithPreparation(int preparation, long idBits) {
    var quality = new CoachQuality(50, preparation);
    return new Coach(
        new CoachId(new UUID(12L, idBits)),
        "Prep-" + preparation,
        CoachTendencies.average(),
        DefensiveCoachTendencies.average(),
        quality);
  }
}
