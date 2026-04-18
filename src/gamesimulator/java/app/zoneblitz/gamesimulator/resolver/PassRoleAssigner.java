package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;

/**
 * Assigns per-snap pass-play role buckets for the supplied play call. Pure given its inputs — no
 * RNG, no state mutation.
 *
 * <p>The default {@link PositionBasedPassRoleAssigner} buckets by position alone; later assigners
 * will honor blitz packages, max protect, and substitutions within the supplied personnel. Run-play
 * bucketing lives on {@link RunRoleAssigner}.
 */
public interface PassRoleAssigner {

  /**
   * Assign role buckets for the supplied offensive call and on-field personnel.
   *
   * @param call the offensive play call
   * @param offense offensive personnel (blockers, route runners)
   * @param defense defensive personnel (rushers, coverage defenders)
   * @return the role buckets for this snap
   */
  PassRoles assign(
      PlayCaller.PlayCall call, OffensivePersonnel offense, DefensivePersonnel defense);
}
