package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;

/**
 * Assigns per-snap run-play role buckets for the supplied play call. Pure given its inputs — no
 * RNG, no state mutation.
 *
 * <p>The default {@link PositionBasedRunRoleAssigner} buckets by position alone; later assigners
 * will honor rush concept, lead-blocking TEs, pulling linemen, and box counts within the supplied
 * personnel. Pass-play bucketing lives on {@link PassRoleAssigner}.
 */
public interface RunRoleAssigner {

  /**
   * Assign role buckets for the supplied offensive call and on-field personnel.
   *
   * @param call the offensive play call
   * @param offense offensive personnel (carrier, blockers)
   * @param defense defensive personnel (run defenders)
   * @return the role buckets for this snap
   */
  RunRoles assign(PlayCaller.PlayCall call, OffensivePersonnel offense, DefensivePersonnel defense);
}
