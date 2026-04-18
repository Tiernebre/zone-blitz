package app.zoneblitz.gamesimulator;

import java.util.Optional;

/**
 * Details of a fumble on a play: who fumbled, whether the defense recovered, the recovering player
 * (if any), and yards returned on the recovery.
 */
public record FumbleOutcome(
    PlayerId fumbledBy, boolean defenseRecovered, Optional<PlayerId> recoveredBy, int returnYards) {
  public FumbleOutcome {
    java.util.Objects.requireNonNull(fumbledBy, "fumbledBy");
    java.util.Objects.requireNonNull(recoveredBy, "recoveredBy");
  }
}
