package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.event.FumbleOutcome;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import java.util.List;

/**
 * Strategy for resolving a loose ball into a concrete {@link FumbleOutcome}. Given the fumbler and
 * the two candidate pools (offensive teammates and defenders), decides whether the defense recovers
 * and which specific player comes up with the ball.
 *
 * <p>The returned outcome is the full surface a {@link app.zoneblitz.gamesimulator.event.PlayEvent}
 * exposes: consumers must be able to render {@code "fumble recovered by Jones"} or {@code
 * "recovered by own teammate Smith"} without any downstream imputation. That means the recoverer is
 * never empty — callers should never invoke this model for a fumble that has no live recovery
 * candidates.
 */
public interface FumbleRecoveryModel {

  /**
   * Resolve a loose ball into a full {@link FumbleOutcome}.
   *
   * @param fumbledBy the player who fumbled; must appear in {@code offensiveTeammates}
   * @param offensiveTeammates the 11 offensive players on the field (including the fumbler); the
   *     fumbler is excluded from recovery candidates
   * @param defenders the 11 defensive players on the field — all eligible recovery candidates
   * @param rng randomness source; drawn from for the recovery coin flip and the recoverer pick
   * @return a fumble outcome with a non-empty {@code recoveredBy} player
   * @throws IllegalArgumentException if there are no recovery candidates on either side
   */
  FumbleOutcome resolve(
      PlayerId fumbledBy,
      List<Player> offensiveTeammates,
      List<Player> defenders,
      RandomSource rng);
}
