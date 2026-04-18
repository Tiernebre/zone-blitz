package app.zoneblitz.gamesimulator.roster;

import app.zoneblitz.gamesimulator.event.PlayerId;
import java.util.Objects;

/**
 * A player participating in a simulated game. Pre-fetched by the caller from the roster feature's
 * public use case; the sim never touches persistence.
 *
 * <p>Carries the three attribute families ({@link Physical}, {@link Skill}, {@link Tendencies}) the
 * matchup resolvers consume. The legacy three-argument constructor is retained for roster fixtures
 * that don't care about attributes — it fills every family with the {@code average()} midpoint,
 * which collapses every matchup aggregate to zero.
 */
public record Player(
    PlayerId id,
    Position position,
    String displayName,
    Physical physical,
    Skill skill,
    Tendencies tendencies) {

  public Player {
    Objects.requireNonNull(id, "id");
    Objects.requireNonNull(position, "position");
    Objects.requireNonNull(displayName, "displayName");
    Objects.requireNonNull(physical, "physical");
    Objects.requireNonNull(skill, "skill");
    Objects.requireNonNull(tendencies, "tendencies");
  }

  public Player(PlayerId id, Position position, String displayName) {
    this(id, position, displayName, Physical.average(), Skill.average(), Tendencies.average());
  }
}
