package app.zoneblitz.gamesimulator.output;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.event.TeamId;
import java.util.Map;
import java.util.Objects;

/**
 * Side-channel context the stats assembler needs because {@link
 * app.zoneblitz.gamesimulator.event.PlayEvent} variants do not carry team identifiers directly.
 *
 * <p>Consumers build this once from their rosters before folding events: the {@link #home} / {@link
 * #away} team ids, plus a {@link PlayerId} &rarr; {@link TeamId} map covering every player on
 * either active roster.
 *
 * <p>Players missing from the map are treated as belonging to no team — their per-player line is
 * still recorded but they do not contribute to any team total.
 */
public record TeamAssignment(TeamId home, TeamId away, Map<PlayerId, TeamId> playerTeam) {

  public TeamAssignment {
    Objects.requireNonNull(home, "home");
    Objects.requireNonNull(away, "away");
    Objects.requireNonNull(playerTeam, "playerTeam");
    playerTeam = Map.copyOf(playerTeam);
  }

  /** Returns the {@link TeamId} mapped to {@code side}. */
  public TeamId teamFor(Side side) {
    return switch (side) {
      case HOME -> home;
      case AWAY -> away;
    };
  }
}
