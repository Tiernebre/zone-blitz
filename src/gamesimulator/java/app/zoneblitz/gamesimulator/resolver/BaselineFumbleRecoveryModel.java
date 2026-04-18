package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.band.BandSampler;
import app.zoneblitz.gamesimulator.band.DistributionalBand;
import app.zoneblitz.gamesimulator.event.FumbleOutcome;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * First-cut fumble-recovery model. Flips one weighted coin for "defense recovers vs offense
 * recovers", then picks a recoverer uniformly at random from the winning pool. League-wide 2022-24
 * play-by-play shows defense recovers a loose ball roughly half the time — the default rate is
 * {@code 0.5}.
 *
 * <p>Return yards are zero for offense recoveries (the ballcarrier falls on it) and sampled from a
 * {@link DistributionalBand} for defense recoveries. The band is zero-heavy — real NFL defensive
 * recoveries return for no yards on most attempts, with the ~6-7% fumble-return-TD rate coming out
 * of the long tail. When no band and no sampler are supplied (legacy callers), return yards are
 * zero on every recovery.
 *
 * <p>Offense recoveries draw from offensive teammates excluding the fumbler; defense recoveries
 * draw from all defenders. Both pools use a role-agnostic uniform pick — proximity/role shaping
 * will land in a later iteration without changing this interface.
 */
public final class BaselineFumbleRecoveryModel implements FumbleRecoveryModel {

  public static final double DEFAULT_DEFENSE_RECOVERY_RATE = 0.5;

  private final double defenseRecoveryRate;
  private final Optional<BandSampler> sampler;
  private final Optional<DistributionalBand> defenseReturnYards;

  public BaselineFumbleRecoveryModel() {
    this(DEFAULT_DEFENSE_RECOVERY_RATE);
  }

  public BaselineFumbleRecoveryModel(double defenseRecoveryRate) {
    this(defenseRecoveryRate, Optional.empty(), Optional.empty());
  }

  public BaselineFumbleRecoveryModel(
      double defenseRecoveryRate, BandSampler sampler, DistributionalBand defenseReturnYards) {
    this(
        defenseRecoveryRate,
        Optional.of(Objects.requireNonNull(sampler, "sampler")),
        Optional.of(Objects.requireNonNull(defenseReturnYards, "defenseReturnYards")));
  }

  private BaselineFumbleRecoveryModel(
      double defenseRecoveryRate,
      Optional<BandSampler> sampler,
      Optional<DistributionalBand> defenseReturnYards) {
    if (defenseRecoveryRate < 0.0 || defenseRecoveryRate > 1.0) {
      throw new IllegalArgumentException(
          "defenseRecoveryRate must be in [0, 1]; got " + defenseRecoveryRate);
    }
    this.defenseRecoveryRate = defenseRecoveryRate;
    this.sampler = sampler;
    this.defenseReturnYards = defenseReturnYards;
  }

  @Override
  public FumbleOutcome resolve(
      PlayerId fumbledBy,
      List<Player> offensiveTeammates,
      List<Player> defenders,
      RandomSource rng) {
    Objects.requireNonNull(fumbledBy, "fumbledBy");
    Objects.requireNonNull(offensiveTeammates, "offensiveTeammates");
    Objects.requireNonNull(defenders, "defenders");
    Objects.requireNonNull(rng, "rng");

    var offenseCandidates =
        offensiveTeammates.stream().filter(p -> !p.id().equals(fumbledBy)).toList();
    if (offenseCandidates.isEmpty() && defenders.isEmpty()) {
      throw new IllegalArgumentException("no recovery candidates available on either side");
    }

    var coin = rng.nextDouble();
    var defenseWins =
        offenseCandidates.isEmpty() || (!defenders.isEmpty() && coin < defenseRecoveryRate);
    var pool = defenseWins ? defenders : offenseCandidates;
    var index = Math.floorMod(rng.nextLong(), pool.size());
    var recoverer = pool.get(index).id();

    var returnYards =
        defenseWins && sampler.isPresent() && defenseReturnYards.isPresent()
            ? sampler.get().sampleDistribution(defenseReturnYards.get(), 0.0, rng)
            : 0;

    return new FumbleOutcome(fumbledBy, defenseWins, Optional.of(recoverer), returnYards);
  }
}
