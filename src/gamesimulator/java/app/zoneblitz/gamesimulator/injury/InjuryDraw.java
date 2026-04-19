package app.zoneblitz.gamesimulator.injury;

import app.zoneblitz.gamesimulator.event.InjurySeverity;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.roster.Position;
import java.util.Objects;

/**
 * A single injury produced by an {@link InjuryModel} for a snap. The simulator emits a
 * corresponding {@link app.zoneblitz.gamesimulator.event.PlayEvent.Injury} and removes the player
 * from subsequent {@link app.zoneblitz.gamesimulator.personnel.PersonnelSelector} draws by adding
 * the id to {@link app.zoneblitz.gamesimulator.GameState#injuredPlayers}.
 */
public record InjuryDraw(PlayerId player, Side side, Position position, InjurySeverity severity) {

  public InjuryDraw {
    Objects.requireNonNull(player, "player");
    Objects.requireNonNull(side, "side");
    Objects.requireNonNull(position, "position");
    Objects.requireNonNull(severity, "severity");
  }
}
