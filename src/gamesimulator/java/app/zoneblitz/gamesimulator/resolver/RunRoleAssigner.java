package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.roster.Team;

/**
 * Assigns per-snap run-play role buckets for the supplied play call. Pure given its inputs — no
 * RNG, no state mutation.
 *
 * <p>The default {@link PositionBasedRunRoleAssigner} buckets by {@link
 * app.zoneblitz.gamesimulator.roster.Position} alone; later assigners will honor rush concept,
 * lead-blocking TEs, pulling linemen, and box counts. Pass-play bucketing lives on {@link
 * PassRoleAssigner}.
 */
public interface RunRoleAssigner {

  /**
   * Assign role buckets for the supplied offensive call and participating teams.
   *
   * @param call the offensive play call
   * @param offense the offensive team (source of the ball carrier and run blockers)
   * @param defense the defensive team (source of run defenders)
   * @return the role buckets for this snap
   */
  RunRoles assign(PlayCaller.PlayCall call, Team offense, Team defense);
}
