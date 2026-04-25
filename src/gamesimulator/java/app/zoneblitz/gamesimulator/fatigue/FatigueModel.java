package app.zoneblitz.gamesimulator.fatigue;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.roster.DefensiveCoachTendencies;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.Map;

/**
 * Fatigue accounting and rotation. Two responsibilities:
 *
 * <ul>
 *   <li><b>Rotation hook</b> — given the personnel package the {@link
 *       app.zoneblitz.gamesimulator.personnel.PersonnelSelector} picked plus accumulated snap
 *       counts and the relevant coach tendency, swap fatigued starters for fresh backups at
 *       fatigue-prone positions (RB, DL). Returns a {@code package} with an identical position
 *       quota — only individual players change.
 *   <li><b>Performance moderator</b> — answers "how fatigued is this player right now?" as a
 *       multiplier in {@code [floor, 1.0]}. Fresh players return {@code 1.0}; degradation kicks in
 *       past a position-specific snap threshold and is moderated by the player's {@link
 *       app.zoneblitz.gamesimulator.roster.Tendencies#motor()} attribute. Resolvers may consult
 *       this to scale matchup advantages, but the engine itself does not — degradation is observed
 *       via reduced snap concentration on starters once rotation kicks in.
 * </ul>
 *
 * <p>Implementations are pure given inputs.
 */
public interface FatigueModel {

  /**
   * Rotate fatigued offensive skill players. Today only the running back position rotates: when
   * RB1's snap count crosses a fatigue threshold and a fresher backup exists on the roster, the
   * backup takes the snap. Position quotas are preserved.
   */
  OffensivePersonnel rotateOffense(
      OffensivePersonnel base, Team offense, Map<PlayerId, Integer> snapCounts);

  /**
   * Rotate fatigued defensive front players. Defensive linemen committee in based on snap counts
   * and the coach's {@link DefensiveCoachTendencies#substitutionAggression()} — aggressive
   * coordinators rotate sooner, conservative coordinators ride starters longer.
   */
  DefensivePersonnel rotateDefense(
      DefensivePersonnel base,
      Team defense,
      Map<PlayerId, Integer> snapCounts,
      DefensiveCoachTendencies coach);

  /**
   * Performance multiplier for {@code player} given accumulated snap count. Returns {@code 1.0}
   * before the position-specific threshold, then decays linearly toward a floor as snaps pile up.
   * High motor pushes the threshold later; low motor brings it earlier.
   */
  double performanceMultiplier(Player player, int snapCount);
}
