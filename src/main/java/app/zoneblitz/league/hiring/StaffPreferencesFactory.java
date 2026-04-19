package app.zoneblitz.league.hiring;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.league.geography.Climate;
import app.zoneblitz.league.geography.Geography;
import app.zoneblitz.league.geography.MarketSize;
import app.zoneblitz.league.staff.RoleScope;
import app.zoneblitz.league.staff.StaffContinuity;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Shared preferences-draft builder for subordinate staff generators (coordinators, position
 * coaches, scouts). Produces a uniform-ish weight profile so these lightweight placeholder
 * candidates can be persisted and scored by {@link OfferScoring} without special casing. Extracted
 * so each generator doesn't reimplement the same weight-normalization math.
 */
public final class StaffPreferencesFactory {

  private static final List<String> SCHEMES =
      List.of("SPREAD", "WEST_COAST", "AIR_RAID", "SMASHMOUTH", "COVER_2", "COVER_3");

  private StaffPreferencesFactory() {}

  static CandidatePreferencesDraft uniform(
      BigDecimal compensation, int contractLength, BigDecimal guaranteedMoney, RandomSource rng) {
    var rawWeights = new double[13];
    for (var i = 0; i < rawWeights.length; i++) {
      rawWeights[i] = 0.25 + rng.nextDouble();
    }
    var sum = 0.0;
    for (var w : rawWeights) sum += w;
    var w = new BigDecimal[13];
    for (var i = 0; i < rawWeights.length; i++) {
      w[i] = BigDecimal.valueOf(rawWeights[i] / sum).setScale(3, RoundingMode.HALF_UP);
    }

    var marketSize = MarketSize.values()[(int) (rng.nextDouble() * MarketSize.values().length)];
    var geography = Geography.values()[(int) (rng.nextDouble() * Geography.values().length)];
    var climate = Climate.values()[(int) (rng.nextDouble() * Climate.values().length)];
    var roleScope = RoleScope.values()[(int) (rng.nextDouble() * RoleScope.values().length)];
    var staffContinuity =
        StaffContinuity.values()[(int) (rng.nextDouble() * StaffContinuity.values().length)];
    var competitiveWindow =
        CompetitiveWindow.values()[(int) (rng.nextDouble() * CompetitiveWindow.values().length)];
    var schemeAlignment = SCHEMES.get((int) (rng.nextDouble() * SCHEMES.size()));

    return new CandidatePreferencesDraft(
        compensation,
        w[0],
        contractLength,
        w[1],
        guaranteedMoney,
        w[2],
        marketSize,
        w[3],
        geography,
        w[4],
        climate,
        w[5],
        BigDecimal.valueOf(50 + rng.nextDouble() * 30).setScale(2, RoundingMode.HALF_UP),
        w[6],
        competitiveWindow,
        w[7],
        roleScope,
        w[8],
        staffContinuity,
        w[9],
        schemeAlignment,
        w[10],
        BigDecimal.valueOf(50 + rng.nextDouble() * 30).setScale(2, RoundingMode.HALF_UP),
        w[11],
        BigDecimal.valueOf(50 + rng.nextDouble() * 30).setScale(2, RoundingMode.HALF_UP),
        w[12]);
  }
}
