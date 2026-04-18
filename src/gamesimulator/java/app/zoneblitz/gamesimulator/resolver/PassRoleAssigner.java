package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.roster.Team;

/**
 * Assigns per-snap pass-play role buckets for the supplied play call. Pure given its inputs — no
 * RNG, no state mutation.
 *
 * <p>The default {@link PositionBasedPassRoleAssigner} buckets by {@link
 * app.zoneblitz.gamesimulator.roster.Position} alone; later assigners will honor personnel, blitz
 * packages, max protect, and substitutions. Run-play bucketing lives on {@link RunRoleAssigner}.
 */
public interface PassRoleAssigner {

  /**
   * Assign role buckets for the supplied offensive call and participating teams.
   *
   * @param call the offensive play call
   * @param offense the offensive team (source of blockers, route runners)
   * @param defense the defensive team (source of rushers, coverage defenders)
   * @return the role buckets for this snap
   */
  PassRoles assign(PlayCaller.PlayCall call, Team offense, Team defense);
}
