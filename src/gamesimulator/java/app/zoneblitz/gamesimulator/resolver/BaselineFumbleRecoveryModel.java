package app.zoneblitz.gamesimulator.resolver;

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
 * {@code 0.5}. Return yards on the recovery are zeroed; yardage modeling is a separate calibration
 * target.
 *
 * <p>Offense recoveries draw from offensive teammates excluding the fumbler; defense recoveries
 * draw from all defenders. Both pools use a role-agnostic uniform pick — proximity/role shaping
 * will land in a later iteration without changing this interface.
 */
public final class BaselineFumbleRecoveryModel implements FumbleRecoveryModel {

  public static final double DEFAULT_DEFENSE_RECOVERY_RATE = 0.5;

  private final double defenseRecoveryRate;

  public BaselineFumbleRecoveryModel() {
    this(DEFAULT_DEFENSE_RECOVERY_RATE);
  }

  public BaselineFumbleRecoveryModel(double defenseRecoveryRate) {
    if (defenseRecoveryRate < 0.0 || defenseRecoveryRate > 1.0) {
      throw new IllegalArgumentException(
          "defenseRecoveryRate must be in [0, 1]; got " + defenseRecoveryRate);
    }
    this.defenseRecoveryRate = defenseRecoveryRate;
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

    return new FumbleOutcome(fumbledBy, defenseWins, Optional.of(recoverer), 0);
  }
}
