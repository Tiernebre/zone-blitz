package app.zoneblitz.gamesimulator.penalty;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.TestPersonnel;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
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

  @Test
  void preSnap_aggregateRate_matchesCatalogWithinTolerance() {
    var root = new SplittableRandomSource(0xC0FFEEL);
    var hits = 0;
    for (var i = 0; i < DRAWS; i++) {
      if (model.preSnap(state, offense, defense, root.split(i)).isPresent()) {
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
}
