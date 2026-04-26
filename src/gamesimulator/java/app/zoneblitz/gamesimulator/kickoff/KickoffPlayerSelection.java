package app.zoneblitz.gamesimulator.kickoff;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.Comparator;
import java.util.function.ToIntFunction;

/**
 * Skill-ranked picks for the players involved in a kickoff. Falls back to {@code roster.get(0)}
 * when no eligible player exists, matching the long-standing resolver fallback semantics.
 */
final class KickoffPlayerSelection {

  private KickoffPlayerSelection() {}

  /** Highest-{@link app.zoneblitz.gamesimulator.roster.Skill#kickPower} K on the roster. */
  static PlayerId pickPowerKicker(Team team) {
    return pickKickerBy(team, p -> p.skill().kickPower());
  }

  /** Highest-{@link app.zoneblitz.gamesimulator.roster.Skill#kickAccuracy} K on the roster. */
  static PlayerId pickAccuracyKicker(Team team) {
    return pickKickerBy(team, p -> p.skill().kickAccuracy());
  }

  /**
   * Highest-{@link app.zoneblitz.gamesimulator.roster.Skill#ballSkills} non-K, non-P on the roster.
   */
  static PlayerId pickOnsideRecoverer(Team team) {
    return team.roster().stream()
        .filter(p -> p.position() != Position.K && p.position() != Position.P)
        .max(Comparator.comparingInt((Player p) -> p.skill().ballSkills()))
        .map(Player::id)
        .orElseGet(() -> team.roster().get(0).id());
  }

  private static PlayerId pickKickerBy(Team team, ToIntFunction<Player> ranker) {
    return team.roster().stream()
        .filter(p -> p.position() == Position.K)
        .max(Comparator.comparingInt(ranker))
        .map(Player::id)
        .orElseGet(() -> team.roster().get(0).id());
  }
}
